'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/admin/AdminContext';
import { confirmDialog } from '@/components/admin/Confirm';
import { useAction } from '@/components/admin/useAction';
import { supabaseBrowser } from '@/lib/supabase/client';

type A = { user_id: string; email: string; role: string; created_at: string };

export default function AdminsPage() {
  const { can, userId, toast } = useAdmin();
  const { busy, run } = useAction();
  const sb = supabaseBrowser();
  const [list, setList] = useState<A[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('scorer');
  const load = useCallback(() => sb.from('admin_users').select('*').order('created_at').then(({ data }) => setList((data as A[]) ?? [])), [sb]);
  useEffect(() => { void load(); }, [load]);
  if (!can('owner')) return <div className="ws-card">Owners only.</div>;
  return (
    <>
      <div className="section-head"><div className="section-title-wrap"><div className="section-kicker">👤 OWNER · SCORER (MATCH CONTROL ONLY) · VIEWER (READ-ONLY)</div><h2 className="section-title"><span className="word-cyan">ADMIN</span> <span className="word-lime">USERS</span></h2><div className="section-underline" /></div></div>
      <form className="ws-card lime-bottom" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end', marginBottom: '1rem' }} onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(async () => {
          const r = await fetch('/api/admin/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, role }) });
          const j = await r.json();
          if (!r.ok) return { error: { message: j.error } };
          toast(j.invited ? `Invite sent to ${email}` : `${email} added — magic link sent`);
        });
        if (ok) { setEmail(''); void load(); }
      }}>
        <div style={{ flex: '1 1 220px' }}><label className="form-label">EMAIL</label><input className="form-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="form-label">ROLE</label><select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}><option value="scorer">scorer</option><option value="viewer">viewer</option><option value="owner">owner</option></select></div>
        <button className="btn-skew btn-lime" disabled={busy}><span>INVITE</span></button>
      </form>
      <div className="ws-card">
        {list.map((a) => (
          <div key={a.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
            <span>{a.email}{a.user_id === userId && ' (you)'}</span>
            <span style={{ display: 'flex', gap: '0.4rem' }}>
              <select className="form-select" value={a.role} disabled={busy} onChange={(e) => run(() => sb.from('admin_users').update({ role: e.target.value }).eq('user_id', a.user_id), 'Role changed').then(() => load())}>
                <option value="owner">owner</option><option value="scorer">scorer</option><option value="viewer">viewer</option>
              </select>
              <button type="button" className="btn-skew btn-danger-outline" disabled={busy} onClick={async () => {
                if (await confirmDialog({ title: 'REMOVE ADMIN', danger: true, body: `Remove ${a.email}'s admin access? (The last owner cannot be removed.)` })) { await run(() => sb.from('admin_users').delete().eq('user_id', a.user_id), 'Removed'); void load(); }
              }}><span>REMOVE</span></button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
