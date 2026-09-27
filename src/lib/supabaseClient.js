import { createClient } from '@supabase/supabase-js';

// Supabase 專案網址與 anon key 本來就是「公開」的值：會被打包進前端 JS、每個訪客的瀏覽器都看得到，
// 資料安全靠的是資料表的 Row Level Security（本專案所有表對 anon 只開放唯讀）。
// 所以這裡內建預設值，避免 Vercel 專案漏設環境變數時整個網站白屏
// （2026-09 實際發生過：trade-dashboard-ekbz 沒設 VITE_SUPABASE_*，createClient 直接丟錯）。
// Vercel / .env 有設定 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 時以環境變數為準。
// 注意：service_role key 或資料庫密碼絕對不能放這裡。
const DEFAULT_SUPABASE_URL = 'https://siqwsrleqokjfhvzlfuo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcXdzcmxlcW9ramZodnpsZnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NDA2NzAsImV4cCI6MjEwNTExNjY3MH0.bScqBpDhVDS9aDQi2wRiUlXBvH6j11n7HZxklNuJds8';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
