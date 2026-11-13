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
          <button key={t.id} type="button" className={`filter-btn ${t.id === sel ? 'active' : ''}`} onClick={() => setSel(t.id)}><span style={t.status === 'withdrawn' ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{t.display_name}</span></button>
        ))}
        {owner && <button type="button" className={`filter-btn ${sel === 'new' ? 'active' : ''}`} onClick={() => setSel('new')}><span>+ ADD TEAM</span></button>}
      </div>
      {sel === 'new' && owner && <AddTeam run={run} busy={busy} onDone={(id) => setSel(id)} />}
      {team && owner && <TeamActions team={team} run={run} busy={busy} onReplaced={(id) => setSel(id)} />}
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
        {field('STATUS', <select className="form-select" value={f.status} disabled={!owner} onChange={(e) => setF({ ...f, status: e.target.value as Team['status'] })}><option value="pending">pending</option><option value="confirmed">confirmed</option>{f.status === 'withdrawn' && <option value="withdrawn" disabled>withdrawn</option>}</select>)}
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
    <div style={{ background: 'rgba(13,42,108,.6)', border: `1px solid ${flag ? 'var(--warning)' : 'rgba(0,229,255,.2)'}`, borderRadius: 10, padding: '0.6rem', opacity: p.active ? 1 : 0.55 }}>
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
            if (p.active && !(await confirmDialog({ title: 'REMOVE PLAYER', body: `Remove ${p.name} from the squad? Nothing is deleted: their goals, cards and ratings stay in the history, and you can restore them any time.`, danger: true, confirmLabel: 'REMOVE' }))) return;
            await run(() => sb.from('players').update({ active: !p.active }).eq('id', p.id), p.active ? 'Player removed from squad' : 'Player restored');
          }}><span>{p.active ? 'REMOVE FROM SQUAD' : 'RESTORE TO SQUAD'}</span></button>
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
      style={{ marginTop: '0.8rem', background: 'rgba(13,42,108,0.75)', border: '1px dashed var(--cyan)', padding: '0.7rem', borderRadius: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
      <div><label className="form-label">PLAYER NAME</label><input className="form-input" value={f.name} disabled={full} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="form-label">POSITION</label><select className="form-select" value={f.position} disabled={full} onChange={(e) => setF({ ...f, position: e.target.value })}>{POS.map((x) => <option key={x}>{x}</option>)}</select></div>
      <div><label className="form-label">JERSEY #</label><input className="form-input" inputMode="numeric" value={f.jersey} disabled={full} onChange={(e) => setF({ ...f, jersey: e.target.value.replace(/\D/g, '').slice(0, 2) })} /></div>
      <button className="btn-skew btn-lime" disabled={busy || full}><span>{full ? 'MAX 10 REACHED' : '+ ADD PLAYER'}</span></button>
    </form>
  );
}

function AddTeam({ run, busy, onDone }: { run: Run; busy: boolean; onDone: (id: string) => void }) {
  const snap = useSnap();
  const sb = supabaseBrowser();
  const [f, setF] = useState({ name: '', short_code: '', color: '#00E5FF', group_id: snap.groups[0]?.id ?? '' });
  return (
    <form className="ws-card lime-bottom" style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', alignItems: 'end' }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!f.name.trim() || !f.short_code.trim()) return;
        let id = '';
        const ok = await run(async () => { const r = await sb.from('teams').insert({ tournament_id: snap.tournament.id, name: f.name.trim(), display_name: f.name.trim(), short_code: f.short_code.trim().toUpperCase(), color: f.color.toUpperCase(), group_id: f.group_id || null, status: 'confirmed' }).select('id').single(); id = r.data?.id ?? ''; return r; }, 'Team added — add its fixtures in Matches');
        if (ok && id) onDone(id);
      }}>
      <div><label className="form-label">TEAM NAME</label><input className="form-input bn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><label className="form-label">SHORT CODE (2–5)</label><input className="form-input" maxLength={5} value={f.short_code} onChange={(e) => setF({ ...f, short_code: e.target.value.toUpperCase() })} /></div>
      <div><label className="form-label">GROUP</label><select className="form-select" value={f.group_id} onChange={(e) => setF({ ...f, group_id: e.target.value })}>{snap.groups.map((g) => <option key={g.id} value={g.id}>Group {g.code}</option>)}</select></div>
      <div><label className="form-label">COLOR</label><input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} style={{ width: 60, height: 38, background: 'transparent', border: 'none' }} /></div>
      <button className="btn-skew btn-lime" disabled={busy}><span>+ ADD TEAM</span></button>
      <p style={{ gridColumn: '1 / -1', fontSize: '0.76rem', color: 'var(--text-muted)' }}>To swap a team mid-tournament use <strong>Replace team</strong> on that team instead — it moves the remaining fixtures automatically.</p>
    </form>
  );
}

function TeamActions({ team, run, busy, onReplaced }: { team: Team; run: Run; busy: boolean; onReplaced: (id: string) => void }) {
  const snap = useSnap();
  const sb = supabaseBrowser();
  const [mode, setMode] = useState<'' | 'replace' | 'withdraw'>('');
  const [f, setF] = useState({ name: '', short: '', color: team.color, transfer: true });
  const [policy, setPolicy] = useState<'keep' | 'expunge'>('keep');
  const future = snap.matches.filter((m) => (m.home_team_id === team.id || m.away_team_id === team.id) && (m.status === 'scheduled' || m.status === 'postponed') && !m.finalized);
  const played = snap.matches.filter((m) => (m.home_team_id === team.id || m.away_team_id === team.id) && m.finalized).length;
  const successor = snap.teams.find((t) => t.replaces_team_id === team.id);
  const predecessor = snap.teams.find((t) => t.id === team.replaces_team_id);
  if (team.status === 'withdrawn') {
    return (
      <div className="ws-card" style={{ borderLeft: '4px solid var(--warning)', marginBottom: '1rem' }}>
        <strong style={{ color: 'var(--warning)' }}>WITHDRAWN</strong>{successor ? <> — replaced by <strong>{successor.display_name}</strong></> : ''}.{' '}
        Played results: {team.results_policy === 'transfer' ? `count for ${successor?.display_name ?? 'the replacement'}` : team.results_policy === 'expunge' ? 'removed from the standings' : 'kept for the opponents'}. Its history stays visible on old match pages.
      </div>
    );
  }
  return (
    <div className="ws-card" style={{ marginBottom: '1rem' }}>
      <div className="rule-sec-title"><span>TEAM CHANGES</span>{predecessor && <span className="badge-skew badge-ko">REPLACED {predecessor.display_name}</span>}</div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className={`btn-skew ${mode === 'replace' ? 'btn-lime' : 'btn-cyan-outline'}`} onClick={() => setMode(mode === 'replace' ? '' : 'replace')}><span>⇄ REPLACE TEAM</span></button>
        <button type="button" className={`btn-skew ${mode === 'withdraw' ? 'btn-danger-outline' : 'btn-cyan-outline'}`} onClick={() => setMode(mode === 'withdraw' ? '' : 'withdraw')}><span>WITHDRAW TEAM</span></button>
      </div>
      {mode === 'replace' && (
        <div style={{ marginTop: '0.8rem', display: 'grid', gap: '0.5rem' }}>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>A new team takes {team.display_name}&apos;s place: its <strong>{future.length}</strong> remaining match{future.length === 1 ? '' : 'es'} move to the new team. {team.display_name} is kept as withdrawn (nothing is deleted). Add the new squad after creating it.</p>
          <div className="grid-3" style={{ gap: '0.5rem' }}>
            <div><label className="form-label">NEW TEAM NAME</label><input className="form-input bn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><label className="form-label">SHORT CODE</label><input className="form-input" maxLength={5} value={f.short} onChange={(e) => setF({ ...f, short: e.target.value.toUpperCase() })} /></div>
            <div><label className="form-label">COLOR</label><input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} style={{ width: 60, height: 38, background: 'transparent', border: 'none' }} /></div>
          </div>
          {played > 0 && (
            <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="radio" checked={f.transfer} onChange={() => setF({ ...f, transfer: true })} /> New team inherits {team.display_name}&apos;s {played} played result{played === 1 ? '' : 's'} (points carry over)</label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="radio" checked={!f.transfer} onChange={() => setF({ ...f, transfer: false })} /> Start fresh: remove those results from the standings</label>
            </div>
          )}
          <button type="button" className="btn-skew btn-lime" style={{ justifySelf: 'start' }} disabled={busy || !f.name.trim() || f.short.trim().length < 2} onClick={async () => {
            if (!(await confirmDialog({ title: 'REPLACE TEAM', danger: true, confirmLabel: 'REPLACE', body: <>Replace <strong>{team.display_name}</strong> with <strong>{f.name}</strong>? {future.length} remaining match{future.length === 1 ? '' : 'es'} move over; {played ? (f.transfer ? 'played results carry over.' : 'played results are removed from the standings.') : ''}</> }))) return;
            let nid = '';
            const ok = await run(async () => { const r = await sb.rpc('admin_team_replace', { p_old: team.id, p_name: f.name.trim(), p_display: f.name.trim(), p_short: f.short.trim(), p_color: f.color.toUpperCase(), p_transfer: f.transfer }); nid = (r.data as string) ?? ''; return r; }, 'Team replaced — now add the new squad');
            if (ok && nid) onReplaced(nid);
          }}><span>REPLACE TEAM</span></button>
        </div>
      )}
      {mode === 'withdraw' && (
        <div style={{ marginTop: '0.8rem', display: 'grid', gap: '0.5rem', fontSize: '0.85rem' }}>
          <p style={{ color: 'var(--text-soft)' }}>{team.display_name}&apos;s <strong>{future.length}</strong> remaining match{future.length === 1 ? '' : 'es'} will be <strong>cancelled</strong> (they can be restored). Nothing is deleted.</p>
          {played > 0 && <>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="radio" checked={policy === 'keep'} onChange={() => setPolicy('keep')} /> Keep the {played} played result{played === 1 ? '' : 's'} for the opponents</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="radio" checked={policy === 'expunge'} onChange={() => setPolicy('expunge')} /> Remove those results from the standings</label>
          </>}
          <button type="button" className="btn-skew btn-danger-outline" style={{ justifySelf: 'start' }} disabled={busy} onClick={async () => {
            if (await confirmDialog({ title: 'WITHDRAW TEAM', danger: true, confirmLabel: 'WITHDRAW', body: `Withdraw ${team.display_name} and cancel ${future.length} remaining match(es)?` }))
              await run(() => sb.rpc('admin_team_withdraw', { p_team: team.id, p_policy: policy }), 'Team withdrawn');
          }}><span>WITHDRAW TEAM</span></button>
        </div>
      )}
    </div>
  );
}
