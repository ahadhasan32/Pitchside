'use client';
import { useEffect, useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { useAdmin } from '@/components/admin/AdminContext';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function RegistrationsArchive() {
  const snap = useSnap();
  const { can } = useAdmin();
  const sb = supabaseBrowser();
  const [tp, setTp] = useState<Record<string, Record<string, unknown>>>({});
  const [pp, setPp] = useState<Record<string, Record<string, unknown>>>({});
  const [subs, setSubs] = useState<{ id: string; created_at: string; status: string; payload: unknown }[]>([]);
  useEffect(() => {
    void Promise.all([sb.from('team_private').select('*'), sb.from('player_private').select('*'), sb.from('registration_submissions').select('*').order('created_at', { ascending: false })]).then(([a, b, c]) => {
      setTp(Object.fromEntries((a.data ?? []).map((r) => [r.team_id, r])));
      setPp(Object.fromEntries((b.data ?? []).map((r) => [r.player_id, r])));
      setSubs(c.data ?? []);
    });
  }, [sb]);
  if (!can('viewer')) return null;
  return (
    <>
      <div className="section-head"><div className="section-title-wrap"><div className="section-kicker">🔒 PRIVATE · READ-ONLY ORIGINAL REGISTRATION DATA</div><h2 className="section-title"><span className="word-cyan">REGISTRATIONS</span> <span className="word-lime">ARCHIVE</span></h2><div className="section-underline" /></div></div>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {[...snap.teams].sort((a, b) => String(tp[a.id]?.registered_at ?? '').localeCompare(String(tp[b.id]?.registered_at ?? ''))).map((t) => {
          const p = tp[t.id] ?? {};
          return (
            <div key={t.id} className="ws-card">
              <div className="rule-sec-title"><span className="bn">{t.name} → {t.display_name}</span><span className="badge-skew badge-ko">{String(p.reg_id ?? '')}</span></div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-soft)', marginBottom: '0.5rem' }}>
                Registered {p.registered_at ? new Date(String(p.registered_at)).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' }) : '—'} · Phone {String(p.contact_phone ?? '—')} · TrxID {String(p.bkash_trx ?? '—')} · Terms {String(p.terms_accepted ?? 'unknown')}
              </div>
              <div className="table-scroll">
                <table className="ws-table" style={{ minWidth: '100%' }}>
                  <thead><tr><th>SLOT</th><th className="col-team">PLAYER</th><th>POSITION</th><th>INSTITUTION</th><th>AGE</th><th>PHONE</th></tr></thead>
                  <tbody>{snap.players.filter((x) => x.team_id === t.id).sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99)).map((x) => { const q = pp[x.id] ?? {}; const age = q.age as number | null; return (
                    <tr key={x.id}><td>{x.slot ? `P${x.slot}` : 'added'}</td><td className="col-team">{x.name}</td><td>{x.position}</td><td>{String(q.institution ?? '')}</td><td style={{ color: age != null && age >= 24 ? 'var(--warning)' : undefined }}>{age ?? ''}{age != null && age >= 24 ? ' ⚠' : ''}</td><td>{String(q.phone ?? '')}</td></tr>); })}</tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
      {can('owner') && (
        <div className="ws-card" style={{ marginTop: '1rem' }}>
          <div className="rule-sec-title"><span>NEW SUBMISSIONS (WHEN REGISTRATION IS REOPENED)</span><span className="badge-skew badge-ko">{subs.length}</span></div>
          {subs.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>None. Submissions are never auto-confirmed; approve them into teams/players manually in Teams & Rosters.</p>
            : subs.map((s) => <pre key={s.id} style={{ fontSize: '0.72rem', whiteSpace: 'pre-wrap', borderBottom: '1px solid rgba(255,255,255,.08)', padding: '0.4rem 0' }}>{s.created_at} · {s.status}{'\n'}{JSON.stringify(s.payload, null, 1)}</pre>)}
        </div>
      )}
    </>
  );
}
