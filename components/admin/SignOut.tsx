'use client';
import { supabaseBrowser } from '@/lib/supabase/client';
export function SignOut() {
  return (
    <button type="button" className="btn-skew btn-cyan-outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}
      onClick={async () => { await supabaseBrowser().auth.signOut(); window.location.href = '/login'; }}>
      <span>SIGN OUT</span>
    </button>
  );
}
