// ==========================================
// 碳費自主減量計畫：快照 → Supabase (PostgreSQL)
// ==========================================
// 一次爬蟲結果（snapshot）在單一交易內寫入：
//   - carbonfee_plans：upsert；這次沒出現的 active 計畫標成 removed（不刪除）
//   - carbonfee_facilities / carbonfee_measures：這次有成功抓到明細的計畫整批替換
//     （明細抓失敗的計畫保留上次的資料，不會被清空）
//   - carbonfee_changes：新增 / 下架 / 重新出現 / 欄位變更
//   - carbonfee_crawl_runs：這次執行的統計
// 批次寫入用 jsonb_to_recordset 一次帶一整包 JSON，避免幾千個 INSERT 來回。

// 需要追蹤異動的計畫欄位：快照欄位 → 資料表欄位
const TRACKED_FIELDS = [
  ['plan_name', (p) => p.name],
  ['tier', (p) => p.tier],
  ['total_base_emission', (p) => p.totals.base],
  ['total_target_emission', (p) => p.totals.target],
  ['period_text', (p) => p.period.text],
  ['participant_count', (p) => p.participantCount],
];

// pg 的 numeric 會回傳字串（'380033.598'），跟快照裡的數字比較前統一轉成正規化字串
const norm = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : String(v);
};

export function diffPlans(existingRows, snapshotPlans) {
  const existing = new Map(existingRows.map((r) => [r.control_no, r]));
  const seen = new Set();
  const changes = [];
  for (const p of snapshotPlans) {
    seen.add(p.controlNo);
    const old = existing.get(p.controlNo);
    if (!old) {
      changes.push({ control_no: p.controlNo, plan_name: p.name, change_type: 'new' });
      continue;
    }
    if (old.status === 'removed') {
      changes.push({ control_no: p.controlNo, plan_name: p.name, change_type: 'restored' });
    }
    for (const [col, pick] of TRACKED_FIELDS) {
      const a = norm(old[col]);
      const b = norm(pick(p));
      if (a !== b) {
        changes.push({ control_no: p.controlNo, plan_name: p.name, change_type: 'updated', field: col, old_value: a, new_value: b });
      }
    }
  }
  for (const r of existingRows) {
    if (!seen.has(r.control_no) && r.status === 'active') {
      changes.push({ control_no: r.control_no, plan_name: r.plan_name, change_type: 'removed' });
    }
  }
  return changes;
}

export async function writeSnapshot(client, snapshot, { force = false, minRatio = 0.8 } = {}) {
  const plans = snapshot.plans;
  const { rows: existingRows } = await client.query(
    `select control_no, plan_name, tier, total_base_emission, total_target_emission, period_text, participant_count, status
       from carbonfee_plans`
  );
  const activeBefore = existingRows.filter((r) => r.status === 'active').length;
  if (!force && activeBefore > 0 && plans.length < activeBefore * minRatio) {
    throw new Error(
      `防呆中止：這次只抓到 ${plans.length} 筆計畫，上次有 ${activeBefore} 筆（低於 ${minRatio * 100}%）。` +
        '可能是官網改版或暫時異常；確認無誤後可加 --force 強制寫入。'
    );
  }

  const changes = diffPlans(existingRows, plans);
  const crawledAt = snapshot.crawledAt;

  await client.query('begin');
  try {
    const { rows: [run] } = await client.query(
      'insert into carbonfee_crawl_runs (started_at) values ($1) returning id',
      [crawledAt]
    );

    const planRows = plans.map((p) => ({
      control_no: p.controlNo,
      plan_name: p.name,
      company: p.company,
      tier: p.tier,
      list_base_emission: p.listBaseEmission,
      list_target_emission: p.listTargetEmission,
      total_base_emission: p.totals.base,
      total_first_year_target: p.totals.firstYearTarget,
      first_year: p.totals.firstYear,
      total_target_emission: p.totals.target,
      period_text: p.period.text,
      period_start: p.period.start,
      period_end: p.period.end,
      is_joint: p.isJoint,
      participant_count: p.participantCount,
    }));
    await client.query(
      `insert into carbonfee_plans (control_no, plan_name, company, tier, list_base_emission, list_target_emission,
          total_base_emission, total_first_year_target, first_year, total_target_emission,
          period_text, period_start, period_end, is_joint, participant_count,
          status, first_seen_at, last_seen_at, updated_at)
       select x.*, 'active', $2::timestamptz, $2::timestamptz, $2::timestamptz
         from jsonb_to_recordset($1::jsonb) as x(control_no text, plan_name text, company text, tier text,
              list_base_emission numeric, list_target_emission numeric, total_base_emission numeric,
              total_first_year_target numeric, first_year int, total_target_emission numeric,
              period_text text, period_start date, period_end date, is_joint boolean, participant_count int)
       on conflict (control_no) do update set
         plan_name = excluded.plan_name, company = excluded.company, tier = excluded.tier,
         list_base_emission = excluded.list_base_emission, list_target_emission = excluded.list_target_emission,
         total_base_emission = excluded.total_base_emission, total_first_year_target = excluded.total_first_year_target,
         first_year = excluded.first_year, total_target_emission = excluded.total_target_emission,
         period_text = excluded.period_text, period_start = excluded.period_start, period_end = excluded.period_end,
         is_joint = excluded.is_joint, participant_count = excluded.participant_count,
         status = 'active', last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at`,
      [JSON.stringify(planRows), crawledAt]
    );

    const seenIds = plans.map((p) => p.controlNo);
    await client.query(
      `update carbonfee_plans set status = 'removed', updated_at = $2
        where status = 'active' and not (control_no = any($1::text[]))`,
      [seenIds, crawledAt]
    );

    // 只替換「這次有成功抓到明細」的計畫
    const detailed = plans.filter((p) => !p.detailError);
    const detailedIds = detailed.map((p) => p.controlNo);
    await client.query('delete from carbonfee_measures where plan_control_no = any($1::text[])', [detailedIds]);
    await client.query('delete from carbonfee_facilities where plan_control_no = any($1::text[])', [detailedIds]);

    const facilityRows = [];
    const measureRows = [];
    for (const p of detailed) {
      for (const f of p.facilities) {
        facilityRows.push({
          plan_control_no: p.controlNo,
          control_no: f.controlNo,
          is_representative: f.isRepresentative,
          name: f.name,
          company: f.company,
          city: f.city,
          address: f.address,
          industries: f.industries,
          primary_industry: f.industries[0] || null,
          boundary_no: f.boundaryNo,
          base_emission: f.emissions.base,
          first_year_target: f.emissions.firstYearTarget,
          target_emission: f.emissions.target,
          raw: f.info,
        });
        for (const m of f.measures) {
          measureRows.push({
            plan_control_no: p.controlNo,
            facility_control_no: f.controlNo,
            roc_year: m.year,
            code: m.code,
            type_raw: m.typeRaw,
            categories: m.categories,
            name: m.name,
          });
        }
      }
    }
    await client.query(
      `insert into carbonfee_facilities (plan_control_no, control_no, is_representative, name, company, city, address,
          industries, primary_industry, boundary_no, base_emission, first_year_target, target_emission, raw, updated_at)
       select x.plan_control_no, x.control_no, x.is_representative, x.name, x.company, x.city, x.address,
              array(select jsonb_array_elements_text(x.industries)), x.primary_industry, x.boundary_no,
              x.base_emission, x.first_year_target, x.target_emission, x.raw, $2::timestamptz
         from jsonb_to_recordset($1::jsonb) as x(plan_control_no text, control_no text, is_representative boolean,
              name text, company text, city text, address text, industries jsonb, primary_industry text,
              boundary_no text, base_emission numeric, first_year_target numeric, target_emission numeric, raw jsonb)
       on conflict (plan_control_no, control_no) do nothing`,
      [JSON.stringify(facilityRows), crawledAt]
    );
    await client.query(
      `insert into carbonfee_measures (plan_control_no, facility_control_no, roc_year, code, type_raw, categories, name)
       select x.plan_control_no, x.facility_control_no, x.roc_year, x.code, x.type_raw,
              array(select jsonb_array_elements_text(x.categories)), x.name
         from jsonb_to_recordset($1::jsonb) as x(plan_control_no text, facility_control_no text, roc_year int,
              code text, type_raw text, categories jsonb, name text)`,
      [JSON.stringify(measureRows)]
    );

    if (changes.length) {
      await client.query(
        `insert into carbonfee_changes (run_id, control_no, plan_name, change_type, field, old_value, new_value, detected_at)
         select $2, x.control_no, x.plan_name, x.change_type, x.field, x.old_value, x.new_value, $3::timestamptz
           from jsonb_to_recordset($1::jsonb) as x(control_no text, plan_name text, change_type text,
                field text, old_value text, new_value text)`,
        [JSON.stringify(changes), run.id, crawledAt]
      );
    }

    const count = (t) => changes.filter((c) => c.change_type === t).length;
    const updatedPlans = new Set(changes.filter((c) => c.change_type === 'updated').map((c) => c.control_no)).size;
    const failed = plans.length - detailed.length;
    const summary = {
      plans: plans.length,
      facilities: facilityRows.length,
      measures: measureRows.length,
      new: count('new'),
      removed: count('removed'),
      restored: count('restored'),
      updatedPlans,
    };
    await client.query(
      `update carbonfee_crawl_runs set finished_at = now(), ok = true, plan_count = $2, facility_count = $3,
          measure_count = $4, new_count = $5, removed_count = $6, updated_count = $7, note = $8
        where id = $1`,
      [run.id, summary.plans, summary.facilities, summary.measures, summary.new, summary.removed, updatedPlans,
        failed ? `${failed} 筆計畫明細抓取失敗，沿用上次資料` : null]
    );
    await client.query('commit');
    return { runId: run.id, summary, changes };
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}
