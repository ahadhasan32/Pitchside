'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useSnap } from '@/components/public/LiveProvider';

type Row = { id: number; at: string; actor_email: string | null; action: string; entity: string; entity_id: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null };
const ENTITIES = ['', 'matches', 'match_events', 'player_match_ratings', 'teams', 'players', 'team_private', 'player_private', 'payments', 'settings', 'awards', 'admin_users'];

function diff(b: Record<string, unknown> | null, a: Record<string, unknown> | null) {
  if (!b || !a) return null;
  return Object.keys(a).filter((k) => !['updated_at', 'version'].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => `${k}: ${JSON.stringify(b[k])} → ${JSON.stringify(a[k])}`);
}

export default function AuditPage() {
  const sb = supabaseBrowser();
  const snap = useSnap();
  const [rows, setRows] = useState<Row[]>([]);
  const [entity, setEntity] = useState('');
  const [actor, setActor] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    let q = sb.from('audit_log').select('*').order('at', { ascending: false }).limit(300);
    if (entity) q = q.eq('entity', entity);
    if (actor) q = q.ilike('actor_email', `%${actor}%`);
    void q.then(({ data }) => setRows((data as Row[]) ?? []));
  }, [sb, entity, actor, snap]);
  const pn = (id: unknown) => snap.players.find((p) => p.id === id)?.name;
  return (
    <>
      <div className="section-head"><div className="section-title-wrap"><div className="section-kicker">❄️ WHO CHANGED WHAT, AND WHEN</div><h2 className="section-title"><span className="word-cyan">AUDIT</span> <span className="word-lime">LOG</span></h2><div className="section-underline" /></div></div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
        <select className="form-select" style={{ maxWidth: 220 }} value={entity} onChange={(e) => setEntity(e.target.value)}>{ENTITIES.map((e) => <option key={e} value={e}>{e || 'all entities'}</option>)}</select>
        <input className="form-input" style={{ maxWidth: 240 }} placeholder="filter by admin email" value={actor} onChange={(e) => setActor(e.target.value)} />
      </div>
      <div className="ws-card">
        {rows.map((r) => {
          const d = diff(r.before, r.after);
          const subj = r.entity === 'match_events' ? `${(r.after ?? r.before)?.type} · ${pn((r.after ?? r.before)?.player_id) ?? ''}` : '';
          return (
            <div key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0.35rem 0', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span style={{ color: 'var(--text-muted)' }}>{new Date(r.at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' })}</span> · <strong>{r.actor_email ?? 'unknown'}</strong> · <span style={{ color: r.action === 'delete' ? 'var(--danger)' : r.action === 'insert' ? 'var(--lime)' : 'var(--cyan)' }}>{r.action}</span> {r.entity} {subj}
              {d && d.length > 0 && <div style={{ color: 'var(--text-soft)' }}>{d.slice(0, 4).join(' · ')}</div>}
              {open === r.id && <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{JSON.stringify({ before: r.before, after: r.after }, null, 1)}</pre>}
            </div>
          );
        })}
      </div>
    </>
  );
}
