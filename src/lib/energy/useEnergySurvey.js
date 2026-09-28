// 讀取問卷資料的 React hook（載入中 / 錯誤 / 重新讀取）。
import { useCallback, useEffect, useState } from 'react';
import { fetchCcusSurvey, fetchHydrogenSurvey } from './fetchEnergySurvey';

function useAsync(fetcher) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const run = useCallback(() => fetcher()
    .then((data) => setState({ data, error: null, loading: false }))
    .catch((e) => setState({ data: null, error: e.message, loading: false })), [fetcher]);
  useEffect(() => { run(); }, [run]);
  const reload = () => { setState((s) => ({ ...s, loading: true, error: null })); run(); };
  return { ...state, reload };
}

export const useCcusSurvey = () => useAsync(fetchCcusSurvey);
export const useHydrogenSurvey = () => useAsync(fetchHydrogenSurvey);
