import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const supabase = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'jiro-log-auth' }
}) : null;
export function client() {
  if (!supabase) throw new Error('Supabaseが設定されていません。');
  return supabase;
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : '処理に失敗しました。もう一度お試しください。';
}
