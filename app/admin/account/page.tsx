'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useAdmin } from '@/components/admin/AdminContext';

export default function AccountPage() {
  const { email, role, toast } = useAdmin();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast('Use at least 8 characters.', true);
    if (pw !== pw2) return toast('Passwords do not match.', true);
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) toast(error.message, true); else { toast('Password saved ✓'); setPw(''); setPw2(''); }
  }
  return (
    <div className="ws-card" style={{ maxWidth: 480 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--lime)', marginBottom: '0.4rem' }}>YOUR ACCOUNT</h2>
      <p style={{ color: 'var(--text-soft)', fontSize: '0.88rem', marginBottom: '1rem' }}>{email} · role <strong>{role}</strong>. Set a password so you can sign in without a magic link.</p>
      <form onSubmit={save} style={{ display: 'grid', gap: '0.6rem' }}>
        <div><label className="form-label">NEW PASSWORD</label><input className="form-input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div><label className="form-label">REPEAT PASSWORD</label><input className="form-input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <button className="btn-skew btn-lime" disabled={busy} style={{ justifySelf: 'start' }}><span>{busy ? 'SAVING…' : 'SAVE PASSWORD'}</span></button>
      </form>
    </div>
  );
}
