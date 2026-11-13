'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { useAdmin } from '@/components/admin/AdminContext';
import { confirmDialog } from '@/components/admin/Confirm';
import { useAction } from '@/components/admin/useAction';
import { TeamCrest } from '@/components/public/bits';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Player, Team } from '@/lib/types';

type TeamPriv = { team_id: string; reg_id: string | null; contact_phone: string | null; bkash_trx: string | null; registered_at: string | null; terms_accepted: string | null; fee_total: number; notes: string | null };
type PlayerPriv = { player_id: string; institution: string | null; age: number | null; phone: string | null; photo_path: string | null };
const POS = ['goalkeeper', 'defender', 'midfielder', 'striker'] as const;

export default function TeamsAdmin() {
  const snap = useSnap();
  const { can, toast } = useAdmin();
  const { busy, run } = useAction();
  const sb = supabaseBrowser();
  const owner = can('owner');
  const seesPrivate = can('owner') || can('viewer');
  const [sel, setSel] = useState<string>(snap.teams[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [tp, setTp] = useState<Record<string, TeamPriv>>({});
  const [pp, setPp] = useState<Record<string, PlayerPriv>>({});
  const [showInactive, setShowInactive] = useState(false);

  const loadPrivate = useCallback(async () => {
    const [a, b] = await Promise.all([sb.from('team_private').select('*'), sb.from('player_private').select('*')]);
    setTp(Object.fromEntries((a.data ?? []).map((r) => [r.team_id, r])));
    setPp(Object.fromEntries((b.data ?? []).map((r) => [r.player_id, r])));
  }, [sb]);
  useEffect(() => { void loadPrivate(); }, [loadPrivate, snap.players.length]);

  const team = snap.teams.find((t) => t.id === sel);
  const s = search.trim().toLowerCase();
  const hits = s ? snap.players.filter((p) => p.name.toLowerCase().includes(s) || (pp[p.id]?.phone ?? '').includes(s) || (pp[p.id]?.institution ?? '').toLowerCase().includes(s)) : [];

  return (
    <>
      <div className="section-head">
        <div className="section-title-wrap"><div className="section-kicker">❄️ ALL TEAM, PLAYER & PRIVATE REGISTRATION DATA</div><h2 className="section-title"><span className="word-cyan">TEAMS &</span> <span className="word-lime">ROSTERS</span></h2><div className="section-underline" /></div>
        {owner && <a className="btn-skew btn-cyan-outline" href="/api/admin/export?what=teams"><span>⬇ EXPORT TEAMS + PLAYERS (CSV)</span></a>}
      </div>
      <input className="form-input" placeholder="Search players by name, phone or institution…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: '0.75rem' }} />
      {s && (
        <div className="ws-card" style={{ marginBottom: '1rem' }}>
          {hits.length === 0 ? 'No matches.' : hits.map((p) => (
            <div key={p.id} style={{ padding: '0.25rem 0', cursor: 'pointer' }} onClick={() => { setSel(p.team_id); setSearch(''); }}>
              {p.name} — {snap.teams.find((t) => t.id === p.team_id)?.display_name}{!p.active && ' (inactive)'}
            </div>
          ))}
        </div>
      )}
      <div className="filter-bar">
        {snap.teams.map((t) => (
          <button key={t.id} type="button" className={`filter-btn ${t.id === sel ? 'active' : ''}`} onClick={() => setSel(t.id)}><span>{t.display_name}</span></button>
        ))}
      </div>
      {team && <TeamEditor key={team.id + team.logo_url} team={team} priv={tp[team.id]} owner={owner} seesPrivate={seesPrivate} busy={busy} run={run} reload={loadPrivate} />}
      {team && (
        <div className="ws-card" style={{ marginTop: '1rem' }}>
          <div className="rule-sec-title">
            <span>ROSTER ({snap.players.filter((p) => p.team_id === team.id && p.active).length}/10)</span>
            <label style={{ fontSize: '0.75rem', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> show inactive</label>
          </div>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {snap.players.filter((p) => p.team_id === team.id && (showInactive || p.active)).sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99)).map((p) => (
              <PlayerEditor key={`${p.id}|${p.name}|${p.jersey}|${p.position}|${p.active}|${p.team_id}`} p={p} priv={pp[p.id]} teams={snap.teams} owner={owner} seesPrivate={seesPrivate} busy={busy} run={run} reload={loadPrivate} toast={toast} />
            ))}
          </div>
          {owner && <AddPlayer teamId={team.id} full={snap.players.filter((p) => p.team_id === team.id && p.active).length >= 10} run={run} busy={busy} />}
        </div>
      )}
    </>
  );
}

type Run = ReturnType<typeof useAction>['run'];

function TeamEditor({ team, priv, owner, seesPrivate, busy, run, reload }: { team: Team; priv?: TeamPriv; owner: boolean; seesPrivate: boolean; busy: boolean; run: Run; reload: () => Promise<void> }) {
  const snap = useSnap();
  const sb = supabaseBrowser();
  const [f, setF] = useState({ display_name: team.display_name, name: team.name, short_code: team.short_code, color: team.color, group_id: team.group_id ?? '', status: team.status, captain_player_id: team.captain_player_id ?? '' });
  const [p, setP] = useState({ contact_phone: priv?.contact_phone ?? '', bkash_trx: priv?.bkash_trx ?? '', notes: priv?.notes ?? '', terms_accepted: priv?.terms_accepted ?? '', fee_total: String(priv?.fee_total ?? 3050) });
  useEffect(() => { setP({ contact_phone: priv?.contact_phone ?? '', bkash_trx: priv?.bkash_trx ?? '', notes: priv?.notes ?? '', terms_accepted: priv?.terms_accepted ?? '', fee_total: String(priv?.fee_total ?? 3050) }); }, [priv]);
  const upload = async (file: File) => {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `teams/${team.id}-${Date.now()}.${ext}`;
    await run(async () => {
      const up = await sb.storage.from('logos').upload(path, file, { contentType: file.type, upsert: true });
      if (up.error) return up;
      return sb.from('teams').update({ logo_url: sb.storage.from('logos').getPublicUrl(path).data.publicUrl }).eq('id', team.id);
    }, 'Logo uploaded');
  };
  const field = (label: string, el: React.ReactNode) => <div><label className="form-label">{label}</label>{el}</div>;
  return (
    <div className="ws-card lime-bottom">
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
        <TeamCrest team={team} size={56} />
        <div><div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}>{team.display_name}</div><div className="bn" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered as: {team.name}{priv?.reg_id ? ` · ${priv.reg_id}` : ''}</div></div>
        {owner && <label className="btn-skew btn-cyan-outline" style={{ cursor: 'pointer' }}><span>⬆ UPLOAD LOGO</span><input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>}
      </div>
      <div className="grid-3" style={{ gap: '0.6rem' }}>
        {field('DISPLAY NAME', <input className="form-input" value={f.display_name} disabled={!owner} onChange={(e) => setF({ ...f, display_name: e.target.value })} />)}
        {field('REGISTERED NAME', <input className="form-input bn" value={f.name} disabled={!owner} onChange={(e) => setF({ ...f, name: e.target.value })} />)}
        {field('SHORT CODE', <input className="form-input" maxLength={5} value={f.short_code} disabled={!owner} onChange={(e) => setF({ ...f, short_code: e.target.value.toUpperCase() })} />)}
        {field('BADGE COLOR', <input type="color" value={f.color} disabled={!owner} onChange={(e) => setF({ ...f, color: e.target.value.toUpperCase() })} style={{ width: 60, height: 38, background: 'transparent', border: 'none' }} />)}
        {field('GROUP', <select className="form-select" value={f.group_id} disabled={!owner} onChange={(e) => setF({ ...f, group_id: e.target.value })}>{snap.groups.map((g) => <option key={g.id} value={g.id}>Group {g.code}</option>)}</select>)}
        {field('STATUS', <select className="form-select" value={f.status} disabled={!owner} onChange={(e) => setF({ ...f, status: e.target.value as Team['status'] })}><option value="pending">pending</option><option value="confirmed">confirmed</option><option value="withdrawn">withdrawn</option></select>)}
        {field('CAPTAIN', <select className="form-select" value={f.captain_player_id} disabled={!owner} onChange={(e) => setF({ ...f, captain_player_id: e.target.value })}><option value="">—</option>{snap.players.filter((x) => x.team_id === team.id && x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>)}
      </div>
      {owner && <button type="button" className="btn-skew btn-lime" style={{ marginTop: '0.7rem' }} disabled={busy} onClick={() => run(() => sb.from('teams').update({ ...f, group_id: f.group_id || null, captain_player_id: f.captain_player_id || null }).eq('id', team.id), 'Team saved')}><span>SAVE TEAM</span></button>}
      {seesPrivate && (
        <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px dashed rgba(204,255,0,.3)' }}>
          <div className="form-label" style={{ color: 'var(--warning)' }}>🔒 PRIVATE (NEVER PUBLIC)</div>
          <div className="grid-3" style={{ gap: '0.6rem' }}>
            {field('CONTACT PHONE', <input className="form-input" value={p.contact_phone} disabled={!owner} onChange={(e) => setP({ ...p, contact_phone: e.target.value })} />)}
            {field('BKASH TRXID', <input className="form-input" value={p.bkash_trx} disabled={!owner} onChange={(e) => setP({ ...p, bkash_trx: e.target.value })} />)}
            {field('FEE TOTAL (৳)', <input className="form-input" inputMode="numeric" value={p.fee_total} disabled={!owner} onChange={(e) => setP({ ...p, fee_total: e.target.value.replace(/[^\d.]/g, '') })} />)}
            {field('TERMS ACCEPTED', <select className="form-select" value={p.terms_accepted} disabled={!owner} onChange={(e) => setP({ ...p, terms_accepted: e.target.value })}><option value="">unknown</option><option value="yes">yes</option><option value="no">no</option></select>)}
            {field('REGISTERED AT', <input className="form-input" disabled value={priv?.registered_at ? new Date(priv.registered_at).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' }) : '—'} />)}
            {field('NOTES', <input className="form-input" value={p.notes} disabled={!owner} onChange={(e) => setP({ ...p, notes: e.target.value })} />)}
          </div>
          {owner && <button type="button" className="btn-skew btn-cyan-outline" style={{ marginTop: '0.7rem' }} disabled={busy} onClick={async () => { await run(() => sb.from('team_private').upsert({ team_id: team.id, contact_phone: p.contact_phone || null, bkash_trx: p.bkash_trx || null, notes: p.notes || null, terms_accepted: p.terms_accepted || null, fee_total: Number(p.fee_total || 0) }), 'Private details saved'); await reload(); }}><span>SAVE PRIVATE DETAILS</span></button>}
        </div>
      )}
    </div>
  );
}

function PlayerEditor({ p, priv, teams, owner, seesPrivate, busy, run, reload, toast }: { p: Player; priv?: PlayerPriv; teams: Team[]; owner: boolean; seesPrivate: boolean; busy: boolean; run: Run; reload: () => Promise<void>; toast: (t: string, bad?: boolean) => void }) {
  const sb = supabaseBrowser();
  const [f, setF] = useState({ name: p.name, position: p.position, jersey: p.jersey?.toString() ?? '', team_id: p.team_id });
  const [x, setX] = useState({ institution: priv?.institution ?? '', age: priv?.age?.toString() ?? '', phone: priv?.phone ?? '' });
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => { setX({ institution: priv?.institution ?? '', age: priv?.age?.toString() ?? '', phone: priv?.phone ?? '' }); }, [priv]);
  useEffect(() => {
    if (!priv?.photo_path || !seesPrivate) return;
    void sb.storage.from('player-photos').createSignedUrl(priv.photo_path, 3600).then(({ data }) => setPhoto(data?.signedUrl ?? null));
  }, [priv?.photo_path, seesPrivate, sb]);
  const flag = priv?.age != null && priv.age >= 24;
  const save = async () => {
    if (f.name.trim() === '') return toast('Name required', true);
    const ok = await run(() => sb.from('players').update({ name: f.name.trim(), position: f.position, jersey: f.jersey === '' ? null : Number(f.jersey), team_id: f.team_id }).eq('id', p.id), 'Player saved');
    if (ok && seesPrivate && owner) { await run(() => sb.from('player_private').upsert({ player_id: p.id, institution: x.institution || null, age: x.age === '' ? null : Number(x.age), phone: x.phone || null })); await reload(); }
  };
  const uploadPhoto = async (file: File) => {
    const path = `players/${p.id}-${Date.now()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`;
    await run(async () => { const up = await sb.storage.from('player-photos').upload(path, file, { contentType: file.type }); if (up.error) return up; return sb.from('player_private').upsert({ player_id: p.id, photo_path: path }); }, 'Photo uploaded');
    await reload();
  };
  return (
    <div style={{ background: 'rgba(5,11,30,.6)', border: `1px solid ${flag ? 'var(--warning)' : 'rgba(0,229,255,.2)'}`, borderRadius: 10, padding: '0.6rem', opacity: p.active ? 1 : 0.55 }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        {photo && <img src={photo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />}
        <strong>{p.name}</strong>
        {!p.active && <span className="mini-tag tag-exp">INACTIVE</span>}
        {flag && <span className="mini-tag tag-susp">⚠ ELIGIBILITY: AGE {priv!.age} (RULE: UNDER 24)</span>}
      </div>
      <div className="grid-4" style={{ gap: '0.4rem' }}>
        <input className="form-input" value={f.name} disabled={!owner} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="name" />
        <select className="form-select" value={f.position} disabled={!owner} onChange={(e) => setF({ ...f, position: e.target.value as Player['position'] })}>{POS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        <input className="form-input" placeholder="Jersey #" inputMode="numeric" value={f.jersey} disabled={!owner} onChange={(e) => setF({ ...f, jersey: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
        <select className="form-select" value={f.team_id} disabled={!owner} onChange={(e) => setF({ ...f, team_id: e.target.value })} title="Move to team">{teams.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}</select>
        {seesPrivate && <>
          <input className="form-input" placeholder="Institution" value={x.institution} disabled={!owner} onChange={(e) => setX({ ...x, institution: e.target.value })} />
          <input className="form-input" placeholder="Age" inputMode="numeric" value={x.age} disabled={!owner} onChange={(e) => setX({ ...x, age: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
          <input className="form-input" placeholder="Phone" value={x.phone} disabled={!owner} onChange={(e) => setX({ ...x, phone: e.target.value })} />
        </>}
      </div>
      {owner && (
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-skew btn-lime" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }} disabled={busy} onClick={save}><span>SAVE</span></button>
          <label className="btn-skew btn-cyan-outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem', cursor: 'pointer' }}><span>PHOTO</span><input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} /></label>
          <button type="button" className="btn-skew btn-danger-outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }} disabled={busy} onClick={async () => {
            if (p.active && !(await confirmDialog({ title: 'DEACTIVATE PLAYER', body: `Deactivate ${p.name}? Their match history and stats are kept.`, danger: true }))) return;
            await run(() => sb.from('players').update({ active: !p.active }).eq('id', p.id), p.active ? 'Player deactivated' : 'Player reactivated');
          }}><span>{p.active ? 'DEACTIVATE' : 'REACTIVATE'}</span></button>
        </div>
      )}
    </div>
  );
}

function AddPlayer({ teamId, full, run, busy }: { teamId: string; full: boolean; run: Run; busy: boolean }) {
  const sb = supabaseBrowser();
  const [f, setF] = useState({ name: '', position: 'midfielder', jersey: '' });
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (!f.name.trim()) return; const ok = await run(() => sb.from('players').insert({ team_id: teamId, name: f.name.trim(), position: f.position, jersey: f.jersey === '' ? null : Number(f.jersey) }), 'Player added'); if (ok) setF({ name: '', position: 'midfielder', jersey: '' }); }}
      style={{ marginTop: '0.8rem', background: 'rgba(5,11,30,0.75)', border: '1px dashed var(--cyan)', padding: '0.7rem', borderRadius: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
      <div><label className="form-label">PLAYER NAME</label><input className="form-input" value={f.name} disabled={full} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="form-label">POSITION</label><select className="form-select" value={f.position} disabled={full} onChange={(e) => setF({ ...f, position: e.target.value })}>{POS.map((x) => <option key={x}>{x}</option>)}</select></div>
      <div><label className="form-label">JERSEY #</label><input className="form-input" inputMode="numeric" value={f.jersey} disabled={full} onChange={(e) => setF({ ...f, jersey: e.target.value.replace(/\D/g, '').slice(0, 2) })} /></div>
      <button className="btn-skew btn-lime" disabled={busy || full}><span>{full ? 'MAX 10 REACHED' : '+ ADD PLAYER'}</span></button>
    </form>
  );
}
