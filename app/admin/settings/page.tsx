'use client';
import { useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { useAdmin } from '@/components/admin/AdminContext';
import { confirmDialog } from '@/components/admin/Confirm';
import { useAction } from '@/components/admin/useAction';
import { supabaseBrowser } from '@/lib/supabase/client';

const TB: Record<string, string> = { gd: 'Goal difference', gf: 'Goals scored', h2h: 'Head-to-head', fairplay: 'Fair play', lot: 'Organiser lot rank' };

export default function SettingsPage() {
  const snap = useSnap();
  const { can } = useAdmin();
  const { busy, run } = useAction();
  const sb = supabaseBrowser();
  const s = snap.settings;
  const [f, setF] = useState({ ...s, banner_en: s.banner_en ?? '', banner_bn: s.banner_bn ?? '' });
  if (!can('owner')) return <div className="ws-card">Owners only.</div>;
  const move = (i: number, d: number) => { const o = [...f.tiebreak_order]; const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; setF({ ...f, tiebreak_order: o }); };
  const save = async () => {
    if (f.registration_open !== s.registration_open && !(await confirmDialog({ title: 'REGISTRATION', body: f.registration_open ? 'Reopen registration? The public can submit (never auto-confirmed).' : 'Close registration?' }))) return;
    await run(async () => {
      const r = await sb.from('settings').update({
        site_mode: f.site_mode, registration_open: f.registration_open, banner_en: f.banner_en || null, banner_bn: f.banner_bn || null,
        tiebreak_order: f.tiebreak_order, knockout_tie_resolution: f.knockout_tie_resolution, second_yellow_points: Number(f.second_yellow_points),
        ratings_published_default: f.ratings_published_default, third_place_enabled: f.third_place_enabled, rating_min_matches: Number(f.rating_min_matches),
        walkover_goals: Number(f.walkover_goals), stage_rules: f.stage_rules, max_eligible_age: Number(f.max_eligible_age) || 24,
      }).eq('tournament_id', s.tournament_id);
      if (r.error || !f.third_place_enabled || snap.matches.some((m) => m.code === 'THIRD')) return r;
      return sb.from('matches').insert({ tournament_id: s.tournament_id, code: 'THIRD', match_no: 16, stage: 'third_place', home_placeholder: 'L(SF1)', away_placeholder: 'L(SF2)', scheduled_at: '2026-11-13T17:30:00+06:00' });
    }, 'Settings saved');
  };
  const row = (label: string, el: React.ReactNode, hint?: React.ReactNode) => (
    <div className="set-row">
      <div className="set-label"><div className="set-name">{label}</div>{hint && <div className="set-hint">{hint}</div>}</div>
      <div className="set-control">{el}</div>
    </div>
  );
  const section = (title: string, children: React.ReactNode) => (
    <section className="set-section"><h3 className="set-title">{title}</h3>{children}</section>
  );
  return (
    <>
      <div className="section-head"><div className="section-title-wrap"><div className="section-kicker">⚙️ OWNER SETTINGS</div><h2 className="section-title"><span className="word-cyan">TOURNAMENT</span> <span className="word-lime">SETTINGS</span></h2><div className="section-underline" /></div></div>
      <div className="ws-card lime-bottom set-card">
        {section('Public site', <>
          {row('Site mode', <select className="form-select" value={f.site_mode} onChange={(e) => setF({ ...f, site_mode: e.target.value as typeof f.site_mode })}><option value="pre">Pre-tournament</option><option value="live">Live</option><option value="completed">Completed</option></select>, 'The countdown shows until the first kick-off. “Completed” reveals champions and awards.')}
          {row('Registration', <select className="form-select" value={String(f.registration_open)} onChange={(e) => setF({ ...f, registration_open: e.target.value === 'true' })}><option value="false">Closed</option><option value="true">Open</option></select>, 'Open = the public can submit a team (never auto-confirmed).')}
          {row('Announcement banner (English)', <input className="form-input" value={f.banner_en} onChange={(e) => setF({ ...f, banner_en: e.target.value })} placeholder="Empty = no banner" />, 'Shown at the top of every public page.')}
          {row('Announcement banner (বাংলা)', <input className="form-input bn" lang="bn" value={f.banner_bn} onChange={(e) => setF({ ...f, banner_bn: e.target.value })} placeholder="Empty = no banner" />)}
        </>)}
        {section('Match rules', <>
          {row('Knockout tie resolution', <select className="form-select" value={f.knockout_tie_resolution} onChange={(e) => setF({ ...f, knockout_tie_resolution: e.target.value })}><option value="penalties">Penalty shootout (§14)</option><option value="organizer">Organiser decision</option></select>, 'How a drawn semifinal or final is decided.')}
          {row('Third-place match', <select className="form-select" value={String(f.third_place_enabled)} onChange={(e) => setF({ ...f, third_place_enabled: e.target.value === 'true' })}><option value="false">Off</option><option value="true">On</option></select>)}
          {row('Walkover score', <input className="form-input set-num" inputMode="numeric" value={f.walkover_goals} onChange={(e) => setF({ ...f, walkover_goals: Number(e.target.value.replace(/\D/g, '') || 0) })} />, 'Goals awarded to the team that turned up. No player gets credit.')}
          {row('Stage durations', (
            <div className="set-stages">
              {Object.entries(f.stage_rules).map(([stage, r]) => (
                <div key={stage} className="set-stage">
                  <span className="set-stage-name">{stage.replace('_', ' ')}</span>
                  <input className="form-input set-num" aria-label={`${stage} minutes`} value={r.normal} onChange={(e) => setF({ ...f, stage_rules: { ...f.stage_rules, [stage]: { ...r, normal: Number(e.target.value.replace(/\D/g, '') || 0) } } })} />
                  <span className="set-unit">min + up to</span>
                  <input className="form-input set-num" aria-label={`${stage} max added minutes`} value={r.max_added} onChange={(e) => setF({ ...f, stage_rules: { ...f.stage_rules, [stage]: { ...r, max_added: Number(e.target.value.replace(/\D/g, '') || 0) } } })} />
                  <span className="set-unit">added</span>
                </div>
              ))}
            </div>
          ), 'Playing time and the maximum added time per stage (minutes).')}
        </>)}
        {section('Standings & discipline', <>
          {row('Tie-break order (after points)', (
            <div className="set-tb">
              {f.tiebreak_order.map((k, i) => (
                <div key={k} className="set-tb-row">
                  <span className="set-tb-n">{i + 1}</span><span style={{ flex: 1 }}>{TB[k] ?? k}</span>
                  <button type="button" className="ev-btn" aria-label={`Move ${TB[k] ?? k} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="ev-btn" aria-label={`Move ${TB[k] ?? k} down`} disabled={i === f.tiebreak_order.length - 1} onClick={() => move(i, 1)}>↓</button>
                </div>
              ))}
            </div>
          ), 'Rulebook §13 order: goal difference → goals scored → head-to-head → fair play → organiser.')}
          {row('Second-yellow fair-play points', <input className="form-input set-num" inputMode="numeric" value={f.second_yellow_points} onChange={(e) => setF({ ...f, second_yellow_points: Number(e.target.value.replace(/\D/g, '') || 0) })} />, 'Added to the first yellow (1). Default 2 → 3 in total, the same as a red. Never double counted.')}
        </>)}
        {section('Players & ratings', <>
          {row('Max eligible age', <input className="form-input set-num" inputMode="numeric" value={f.max_eligible_age} onChange={(e) => setF({ ...f, max_eligible_age: Number(e.target.value.replace(/\D/g, '') || 0) })} />, `Players aged ${f.max_eligible_age} or under are eligible; older players are flagged “over-age” in admin.`)}
          {row('Ratings published by default', <select className="form-select" value={String(f.ratings_published_default)} onChange={(e) => setF({ ...f, ratings_published_default: e.target.value === 'true' })}><option value="false">No — reveal per match</option><option value="true">Yes</option></select>, 'New matches start with ratings public or hidden.')}
          {row('Top-rated minimum', <input className="form-input set-num" inputMode="numeric" value={f.rating_min_matches} onChange={(e) => setF({ ...f, rating_min_matches: Number(e.target.value.replace(/\D/g, '') || 0) })} />, 'Rated matches a player needs to appear in the public “Top rated” list.')}
        </>)}
        <div className="set-save"><button type="button" className="btn-skew btn-lime" disabled={busy} onClick={save}><span>{busy ? 'SAVING…' : 'SAVE SETTINGS'}</span></button></div>
      </div>
      <ClearAll />
      <div className="ws-card" style={{ marginTop: '1rem' }}>
        <div className="rule-sec-title"><span>BACKUPS & EXPORTS</span></div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a className="btn-skew btn-cyan-outline" href="/api/admin/export?what=teams"><span>TEAMS + PLAYERS CSV</span></a>
          <a className="btn-skew btn-cyan-outline" href="/api/admin/export?what=payments"><span>PAYMENTS CSV</span></a>
          <a className="btn-skew btn-cyan-outline" href="/api/admin/export?what=results"><span>MATCH RESULTS CSV</span></a>
        </div>
        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Full database backup: see docs/OPERATIONS.md (pg_dump before match day and after the final).</p>
      </div>
    </>
  );
}

function ClearAll() {
  const snap = useSnap();
  const { email, toast } = useAdmin();
  const { busy, run } = useAction();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [open, setOpen] = useState(false);
  const touched = snap.matches.filter((m) => m.status !== 'scheduled' || m.finalized || snap.events.some((e) => e.match_id === m.id) || snap.ratings.some((r) => r.match_id === m.id));
  const ev = snap.events.length, rt = snap.ratings.length;
  const ko = snap.matches.filter((m) => m.stage !== 'group' && (m.home_team_id || m.away_team_id)).length;
  const pub = snap.awards.filter((a) => a.published).length;
  const close = () => { setOpen(false); setTyped(''); setPassword(''); };
  return (
    <div className="ws-card" style={{ marginTop: '1rem', borderLeft: '4px solid var(--danger)' }}>
      <div className="rule-sec-title"><span>⚠️ RESET TOURNAMENT</span></div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-soft)' }}>
        Puts <strong>{snap.tournament.name}</strong> back to “ready to kick off”. Clears: <strong>{touched.length}</strong> played/started match{touched.length === 1 ? '' : 'es'} ({touched.map((m) => m.code).join(', ') || 'none'}), <strong>{ev}</strong> goal/card event{ev === 1 ? '' : 's'}, <strong>{rt}</strong> rating{rt === 1 ? '' : 's'}, MVPs, lineups, finalized states, the standings confirmation{ko ? `, the team slots of ${ko} knockout match${ko === 1 ? '' : 'es'}` : ''}{pub ? ` and ${pub} published award${pub === 1 ? '' : 's'}` : ''}.
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--lime)', marginTop: '0.4rem' }}>
        Kept: teams, players (incl. removed ones), private details, payments, groups, the full schedule and kick-off times, lot ranks and all settings.
        Nothing is hard-deleted; each match keeps a “Restore last reset”, and the reset is in the audit log.
      </p>
      {!open ? (
        <button type="button" className="btn-skew btn-danger-outline" style={{ marginTop: '0.7rem' }} onClick={() => setOpen(true)}><span>RESET TOURNAMENT…</span></button>
      ) : (
        <form style={{ display: 'flex', gap: '0.6rem', alignItems: 'end', flexWrap: 'wrap', marginTop: '0.7rem' }} onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(async () => {
            const r = await fetch('/api/admin/reset-tournament', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tournamentId: snap.tournament.id, confirm: typed, password }) });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) return { error: { message: j.error ?? 'Reset failed' } };
            toast(`Tournament reset — ${j.matches} match${j.matches === 1 ? '' : 'es'} back to scheduled`);
          });
          if (ok) close(); else setPassword('');
        }}>
          <div><label className="form-label">TYPE RESET</label><input className="form-input" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} style={{ width: 140 }} autoComplete="off" /></div>
          <div><label className="form-label">YOUR ADMIN PASSWORD ({email})</label><input className="form-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: 240 }} /></div>
          <button type="submit" className="btn-skew btn-danger-outline" disabled={busy || typed !== 'RESET' || !password}><span>{busy ? 'RESETTING…' : 'RESET TOURNAMENT'}</span></button>
          <button type="button" className="btn-skew btn-cyan-outline" onClick={close}><span>CANCEL</span></button>
          <p style={{ width: '100%', fontSize: '0.74rem', color: 'var(--text-muted)' }}>Signed in with a magic link and never set a password? Set one first in <a href="/admin/account" style={{ color: 'var(--cyan)' }}>Account</a>.</p>
        </form>
      )}
    </div>
  );
}
