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
  const row = (label: string, el: React.ReactNode, hint?: string) => (
    <div style={{ display: 'grid', gap: '0.25rem' }}><label className="form-label">{label}</label>{el}{hint && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{hint}</span>}</div>
  );
  return (
    <>
      <div className="section-head"><div className="section-title-wrap"><div className="section-kicker">⚙️ OWNER SETTINGS</div><h2 className="section-title"><span className="word-cyan">TOURNAMENT</span> <span className="word-lime">SETTINGS</span></h2><div className="section-underline" /></div></div>
      <div className="ws-card lime-bottom" style={{ display: 'grid', gap: '1rem' }}>
        <div className="grid-3" style={{ gap: '0.8rem' }}>
          {row('SITE MODE', <select className="form-select" value={f.site_mode} onChange={(e) => setF({ ...f, site_mode: e.target.value as typeof f.site_mode })}><option value="pre">pre-tournament</option><option value="live">live</option><option value="completed">completed</option></select>, 'Countdown shows until first kick-off unless completed.')}
          {row('REGISTRATION', <select className="form-select" value={String(f.registration_open)} onChange={(e) => setF({ ...f, registration_open: e.target.value === 'true' })}><option value="false">closed</option><option value="true">open</option></select>)}
          {row('KNOCKOUT TIE RESOLUTION', <select className="form-select" value={f.knockout_tie_resolution} onChange={(e) => setF({ ...f, knockout_tie_resolution: e.target.value })}><option value="penalties">penalty shootout (§14)</option><option value="organizer">organiser decision</option></select>)}
          {row('SECOND-YELLOW FAIR-PLAY POINTS', <input className="form-input" inputMode="numeric" value={f.second_yellow_points} onChange={(e) => setF({ ...f, second_yellow_points: Number(e.target.value.replace(/\D/g, '') || 0) })} />, 'Added to the first yellow (1). Default 2 → total 3, same as a red. Never double counted.')}
          {row('WALKOVER SCORE', <input className="form-input" inputMode="numeric" value={f.walkover_goals} onChange={(e) => setF({ ...f, walkover_goals: Number(e.target.value.replace(/\D/g, '') || 0) })} />, 'Goals awarded (no player credit).')}
          {row('MAX ELIGIBLE AGE', <input className="form-input" inputMode="numeric" value={f.max_eligible_age} onChange={(e) => setF({ ...f, max_eligible_age: Number(e.target.value.replace(/\D/g, '') || 0) })} />, `Players aged ${f.max_eligible_age} or under are eligible; older players are flagged "over-age" in admin.`)}
          {row('TOP-RATED MINIMUM RATED MATCHES', <input className="form-input" inputMode="numeric" value={f.rating_min_matches} onChange={(e) => setF({ ...f, rating_min_matches: Number(e.target.value.replace(/\D/g, '') || 0) })} />)}
          {row('RATINGS PUBLISHED BY DEFAULT', <select className="form-select" value={String(f.ratings_published_default)} onChange={(e) => setF({ ...f, ratings_published_default: e.target.value === 'true' })}><option value="false">no (reveal per match)</option><option value="true">yes</option></select>)}
          {row('THIRD-PLACE MATCH', <select className="form-select" value={String(f.third_place_enabled)} onChange={(e) => setF({ ...f, third_place_enabled: e.target.value === 'true' })}><option value="false">off</option><option value="true">on</option></select>)}
        </div>
        {row('ANNOUNCEMENT BANNER (ENGLISH)', <input className="form-input" value={f.banner_en} onChange={(e) => setF({ ...f, banner_en: e.target.value })} placeholder="Shown on top of every public page" />)}
        {row('ANNOUNCEMENT BANNER (বাংলা)', <input className="form-input bn" lang="bn" value={f.banner_bn} onChange={(e) => setF({ ...f, banner_bn: e.target.value })} />)}
        {row('TIE-BREAK ORDER (AFTER POINTS)', (
          <div style={{ display: 'grid', gap: '0.3rem', maxWidth: 360 }}>
            {f.tiebreak_order.map((k, i) => (
              <div key={k} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ minWidth: 20 }}>{i + 1}.</span><span style={{ flex: 1 }}>{TB[k] ?? k}</span>
                <button type="button" className="filter-btn" onClick={() => move(i, -1)}><span>↑</span></button>
                <button type="button" className="filter-btn" onClick={() => move(i, 1)}><span>↓</span></button>
              </div>
            ))}
          </div>
        ), 'Official rulebook §13 order: GD → GF → head-to-head → fair play → organiser.')}
        {row('STAGE DURATIONS (MINUTES)', (
          <div className="grid-3" style={{ gap: '0.5rem' }}>
            {Object.entries(f.stage_rules).map(([stage, r]) => (
              <div key={stage} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ minWidth: 80 }}>{stage}</span>
                <input className="form-input" style={{ width: 56 }} value={r.normal} onChange={(e) => setF({ ...f, stage_rules: { ...f.stage_rules, [stage]: { ...r, normal: Number(e.target.value.replace(/\D/g, '') || 0) } } })} />
                <span>+ max</span>
                <input className="form-input" style={{ width: 56 }} value={r.max_added} onChange={(e) => setF({ ...f, stage_rules: { ...f.stage_rules, [stage]: { ...r, max_added: Number(e.target.value.replace(/\D/g, '') || 0) } } })} />
              </div>
            ))}
          </div>
        ))}
        <button type="button" className="btn-skew btn-lime" style={{ justifySelf: 'start' }} disabled={busy} onClick={save}><span>SAVE SETTINGS</span></button>
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
