'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { EmailOtpType } from '@supabase/supabase-js';

// Handles every Supabase email-link shape: PKCE ?code, ?token_hash&type, and implicit #access_token (invites).
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const next = params.get('next') || '/admin';
      const hash = new URLSearchParams(window.location.hash.slice(1));
      try {
        const errDesc = params.get('error_description') || hash.get('error_description');
        if (errDesc) throw new Error(errDesc);
        if (hash.get('access_token') && hash.get('refresh_token')) {
          const { error } = await sb.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! });
          if (error) throw error;
        } else if (params.get('code')) {
          const { error } = await sb.auth.exchangeCodeForSession(params.get('code')!);
          if (error) throw error;
        } else if (params.get('token_hash') && params.get('type')) {
          const { error } = await sb.auth.verifyOtp({ token_hash: params.get('token_hash')!, type: params.get('type') as EmailOtpType });
          if (error) throw error;
        }
        const { data } = await sb.auth.getSession();
        if (!data.session) throw new Error('No session — the link may have expired. Request a new one.');
        const type = hash.get('type') || params.get('type');
        router.replace(type === 'invite' || type === 'recovery' ? '/admin/account?setpw=1' : next);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [params, router]);
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem', textAlign: 'center' }}>
      {err ? <div><p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{err}</p><a className="btn-skew btn-lime" href="/login"><span>BACK TO SIGN IN</span></a></div>
        : <p style={{ fontFamily: 'var(--font-sport)', color: 'var(--cyan)' }}>Signing you in…</p>}
    </div>
  );
}
export default function Page() { return <Suspense><Callback /></Suspense>; }
