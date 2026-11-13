'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { useAdmin } from '@/components/admin/AdminContext';
import { confirmDialog } from '@/components/admin/Confirm';
import { useAction } from '@/components/admin/useAction';
import { supabaseBrowser } from '@/lib/supabase/client';

type Pay = { voided_at: string | null; id: string; team_id: string; amount: number; paid_on: string | null; method: string | null; trx_id: string | null; note: string | null; created_at: string };
const tk = (n: number) => `৳${n.toLocaleString('en-US')}`;

export default function PaymentsPage() {
  const snap = useSnap();
  const { can } = useAdmin();
  const { busy, run } = useAction();
  const sb = supabaseBrowser();
  const [pays, setPays] = useState<Pay[]>([]);
  const [fees, setFees] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ team_id: '', amount: '', paid_on: new Date().toISOString().slice(0, 10), method: 'bKash', trx_id: '', note: '' });
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([sb.from('payments').select('*').order('created_at', { ascending: false }), sb.from('team_private').select('team_id, fee_total')]);
    setPays((a.data ?? []).map((p) => ({ ...p, amount: Number(p.amount) })));
    setFees(Object.fromEntries((b.data ?? []).map((r) => [r.team_id, Number(r.fee_total)])));
  }, [sb]);
  useEffect(() => { void load(); }, [load]);
  if (!can('viewer')) return null;
  const owner = can('owner');
  const live = pays.filter((p) => !p.voided_at);
  const paid = (tid: string) => live.filter((p) => p.team_id === tid).reduce((s, p) => s + p.amount, 0);
  const expected = snap.teams.reduce((s, t) => s + (fees[t.id] ?? 0), 0);
  const collected = live.reduce((s, p) => s + p.amount, 0);
  const tn = (id: string) => snap.teams.find((t) => t.id === id)?.display_name ?? '?';
  return (
    <>
      <div className="section-head">
        <div className="section-title-wrap"><div className="section-kicker">🔒 PRIVATE · ENTRY FEE ৳3,050 PER TEAM</div><h2 className="section-title"><span className="word-cyan">TEAM</span> <span className="word-lime">PAYMENTS</span></h2><div className="section-underline" /></div>
        {owner && <a className="btn-skew btn-cyan-outline" href="/api/admin/export?what=payments"><span>⬇ EXPORT CSV</span></a>}
      </div>
      <div className="hero-stat-strip" style={{ marginBottom: '1rem' }}>
        <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">{snap.teams.length}</div><div className="hero-stat-lbl">TEAMS REGISTERED</div></div></div>
        <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">{tk(expected)}</div><div className="hero-stat-lbl">EXPECTED TOTAL</div></div></div>
        <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">{tk(collected)}</div><div className="hero-stat-lbl">COLLECTED SO FAR</div></div></div>
        <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">{tk(expected - collected)}</div><div className="hero-stat-lbl">STILL DUE</div></div></div>
      </div>
      <div className="ws-card" style={{ marginBottom: '1rem' }}>
        <div className="table-scroll">
          <table className="ws-table" style={{ minWidth: '100%' }}>
            <thead><tr><th className="col-team">TEAM</th><th>FEE</th><th>PAID</th><th>DUE</th><th>STATUS</th></tr></thead>
            <tbody>{snap.teams.map((t) => { const f = fees[t.id] ?? 0, p = paid(t.id), d = f - p; return (
              <tr key={t.id}><td className="col-team">{t.display_name}</td><td>{tk(f)}</td><td style={{ color: 'var(--lime)' }}>{tk(p)}</td><td style={{ color: d > 0 ? 'var(--warning)' : 'var(--success)' }}>{tk(d)}</td><td>{d <= 0 ? 'Paid' : p > 0 ? 'Partial' : 'Unpaid'}</td></tr>); })}</tbody>
          </table>
        </div>
      </div>
      {owner && (
        <form className="ws-card lime-bottom" style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', alignItems: 'end' }}
          onSubmit={async (e) => {
            e.preventDefault();
            const amt = Number(form.amount);
            if (!form.team_id || !amt) return;
            if (!(await confirmDialog({ title: 'RECORD PAYMENT', body: `Record ${tk(amt)} from ${tn(form.team_id)}${form.trx_id ? ` (TrxID ${form.trx_id})` : ''}?` }))) return;
            const ok = await run(() => sb.from('payments').insert({ team_id: form.team_id, amount: amt, paid_on: form.paid_on || null, method: form.method || null, trx_id: form.trx_id || null, note: form.note || null }), 'Payment recorded');
            if (ok) { setForm({ ...form, amount: '', trx_id: '', note: '' }); void load(); }
          }}>
          <div><label className="form-label">TEAM</label><select className="form-select" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}><option value="">—</option>{snap.teams.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}</select></div>
          <div><label className="form-label">AMOUNT (৳, NEGATIVE = REFUND)</label><input className="form-input" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.-]/g, '') })} /></div>
          <div><label className="form-label">DATE</label><input className="form-input" type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} /></div>
          <div><label className="form-label">METHOD</label><input className="form-input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></div>
          <div><label className="form-label">TRXID</label><input className="form-input" value={form.trx_id} onChange={(e) => setForm({ ...form, trx_id: e.target.value })} /></div>
          <div><label className="form-label">NOTE</label><input className="form-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <button className="btn-skew btn-lime" disabled={busy}><span>+ RECORD PAYMENT</span></button>
        </form>
      )}
      <div className="ws-card">
        <div className="rule-sec-title"><span>PAYMENT HISTORY ({pays.length})</span></div>
        <div className="table-scroll">
          <table className="ws-table" style={{ minWidth: '100%' }}>
            <thead><tr><th>DATE</th><th className="col-team">TEAM</th><th>AMOUNT</th><th>METHOD</th><th>TRXID</th><th>NOTE</th>{owner && <th />}</tr></thead>
            <tbody>{pays.map((p) => (
              <tr key={p.id} style={p.voided_at ? { opacity: 0.45, textDecoration: 'line-through' } : undefined}><td>{p.paid_on ?? p.created_at.slice(0, 10)}</td><td className="col-team">{tn(p.team_id)}</td><td className="pts-cell">{tk(p.amount)}</td><td>{p.method}</td><td>{p.trx_id}</td><td style={{ fontSize: '0.75rem' }}>{p.note}</td>
                {owner && <td>{p.voided_at ? <button type="button" className="btn-skew btn-cyan-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }} disabled={busy} onClick={async () => { await run(() => sb.from('payments').update({ voided_at: null, voided_by: null }).eq('id', p.id), 'Restored'); void load(); }}><span>RESTORE</span></button>
                  : <button type="button" className="btn-skew btn-danger-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }} disabled={busy} onClick={async () => { if (await confirmDialog({ title: 'VOID PAYMENT ENTRY', danger: true, body: `Void ${tk(p.amount)} from ${tn(p.team_id)}? It stops counting but stays in the history (can be restored).` })) { await run(() => sb.from('payments').update({ voided_at: new Date().toISOString() }).eq('id', p.id), 'Voided'); void load(); } }}><span>VOID</span></button>}</td>}
              </tr>))}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}
