import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, errorMessage } from '../../lib/supabase';
import type { MemberRow } from '../../types/database';
type Auth = { member: MemberRow | null; loading: boolean; error: string; preview: boolean; signOut: () => Promise<void> };
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<MemberRow | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    let active = true; let generation = 0; let checkedUserId: string | null = null;
    const check = async (session: Session | null) => {
      const current = ++generation;
      const nextUserId = session?.user.id ?? null;
      if (nextUserId !== checkedUserId) { setMember(null); setLoading(true); }
      checkedUserId = nextUserId; setError('');
      try {
        if (session) {
          const { data, error } = await db.from('members').select('*').eq('user_id', session.user.id).eq('is_active', true).maybeSingle();
          if (error) throw error;
          if (!data) throw new Error('利用権限がありません。管理者にメンバー登録をご確認ください。');
          if (active && current === generation) setMember(previous => JSON.stringify(previous) === JSON.stringify(data) ? previous : data as MemberRow);
        }
      } catch (e) { if (active && current === generation) { setMember(null); setError(errorMessage(e)); } }
      finally { if (active && current === generation) setLoading(false); }
    };
    // Supabase emits INITIAL_SESSION as well as subsequent sign-in / sign-out changes.
    const { data } = db.auth.onAuthStateChange((_event, session) => { setTimeout(() => { if (active) void check(session); }, 0); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  async function signOut() {
    const result = await supabase?.auth.signOut();
    if (result?.error) throw result.error;
    setMember(null);
  }
  return <Context.Provider value={{ member, loading, error, preview: !supabase, signOut }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider missing'); return value; }
