'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(params.get('error') ? { ok: false, text: params.get('error')! } : null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    router.replace(next);
    router.refresh();
  }
  async function magic() {
    if (!email) return setMsg({ ok: false, text: 'Enter your email first.' });
    setBusy(true); setMsg(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email, options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Magic link sent — check your inbox on this device.' });
  }
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
      <form onSubmit={signIn} className="modal-panel" style={{ maxWidth: 420, width: '100%' }}>
        <div className="modal-header"><div className="modal-title">🔐 ADMIN SIGN IN</div></div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)', marginBottom: '0.85rem' }}>Winter Showdown organisers only. Accounts are invited by an owner.</p>
        <label className="form-label" htmlFor="em">EMAIL</label>
        <input id="em" className="form-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: '0.7rem' }} />
        <label className="form-label" htmlFor="pw">PASSWORD</label>
        <input id="pw" className="form-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: '0.9rem' }} />
        {msg && <div style={{ color: msg.ok ? 'var(--lime)' : 'var(--danger)', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.75rem' }}>{msg.text}</div>}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-skew btn-cyan-outline" onClick={magic} disabled={busy}><span>EMAIL ME A LINK</span></button>
          <button type="submit" className="btn-skew btn-lime" disabled={busy || !password}><span>{busy ? '…' : 'SIGN IN'}</span></button>
        </div>
      </form>
    </div>
  );
}
export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }
