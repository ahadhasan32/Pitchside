'use client';
import Link from 'next/link';
import { use, useMemo, useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { useAdmin } from '@/components/admin/AdminContext';
import { confirmDialog } from '@/components/admin/Confirm';
import { useAction } from '@/components/admin/useAction';
import { BigLogo, TeamCrest, cardIcon, fmtTimeAmPm, placeholderName } from '@/components/public/bits';
import { supabaseBrowser } from '@/lib/supabase/client';
import { computeSuspensions, displayStatus, matchWinnerId, stageLabel } from '@/lib/tournament';
import type { EventType, Match, MatchEvent, Player, Team } from '@/lib/types';

const POS: Record<string, string> = { goalkeeper: 'GK', defender: 'DEF', midfielder: 'MID', striker: 'FWD' };
const CARD_LABEL: Record<string, string> = { yellow: '🟨 Yellow', second_yellow: '🟨🟥 Second yellow (sent off)', red: '🟥 Red (standard / abusive)', red_violent: '🟥 Red — fighting / violence (EXPELLED)' };

type Draft = { id: string; kind: 'goal' | 'card'; forTeam: string; ownGoal: boolean; type: EventType; player: string; assist: string; minute: string; editing: boolean };

export default function MatchControl({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const snap = useSnap();
  const { can, toast } = useAdmin();
  const { busy, run } = useAction();
  const sb = supabaseBrowser();
  const m = snap.matches.find((x) => x.id === id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const susp = useMemo(() => computeSuspensions(snap), [snap]);

  if (!m) return <div className="ws-card">Match not found. <Link href="/admin/matches">Back</Link></div>;
  const team = (tid: string | null) => snap.teams.find((t) => t.id === tid);
  const player = (pid: string | null) => snap.players.find((p) => p.id === pid);
  const home = team(m.home_team_id), away = team(m.away_team_id);
  const evs = snap.events.filter((e) => e.match_id === m.id).sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || a.created_at.localeCompare(b.created_at));
  const roster = (tid: string | null) => snap.players.filter((p) => p.team_id === tid && p.active).sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
  const status = displayStatus(m);
  const isScorer = can('scorer');
  const locked = m.finalized;
  const canEvents = isScorer && !locked && (m.status === 'live' || m.status === 'full_time');
  const isKO = m.stage !== 'group';
  const maxAdded = snap.settings.stage_rules[m.stage]?.max_added ?? 2;
  const g = snap.groups.find((x) => x.id === m.group_id)?.code;

  const action = async (a: string, label: string, confirm?: { title: string; body: React.ReactNode; danger?: boolean }) => {
    if (confirm && !(await confirmDialog({ ...confirm, confirmLabel: label }))) return;
    await run(() => sb.rpc('admin_match_action', { p_match: m.id, p_action: a, p_expected_version: m.version }), `${label} ✓`);
  };
  const patch = async (p: Record<string, unknown>, msg = 'Saved ✓') => run(() => sb.rpc('admin_match_update', { p_match: m.id, p_patch: p, p_expected_version: m.version }), msg);

  const openGoal = (forTeam: string) => setDraft({ id: crypto.randomUUID(), kind: 'goal', forTeam, ownGoal: false, type: 'goal', player: '', assist: '', minute: '', editing: false });
  const openCard = (forTeam: string) => setDraft({ id: crypto.randomUUID(), kind: 'card', forTeam, ownGoal: false, type: 'yellow', player: '', assist: '', minute: '', editing: false });
  const editEvent = (e: MatchEvent) => {
    const isGoal = e.type === 'goal' || e.type === 'own_goal';
    const forTeam = e.type === 'own_goal' ? (e.team_id === m.home_team_id ? m.away_team_id! : m.home_team_id!) : e.team_id;
    setDraft({ id: e.id, kind: isGoal ? 'goal' : 'card', forTeam, ownGoal: e.type === 'own_goal', type: e.type, player: e.player_id, assist: e.assist_player_id ?? '', minute: e.minute?.toString() ?? '', editing: true });
  };
  const delEvent = async (e: MatchEvent) => {
    if (!(await confirmDialog({ title: 'REMOVE EVENT', body: <>Delete {e.type.replace('_', ' ')} by <strong>{player(e.player_id)?.name}</strong>? Score and stats recalculate. (Kept in the audit history.)</>, danger: true, confirmLabel: 'REMOVE' }))) return;
    await run(() => sb.rpc('admin_event_delete', { p_id: e.id }), 'Event removed');
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.player) return toast('Pick a player.', true);
    const playerTeam = draft.kind === 'goal' && draft.ownGoal ? (draft.forTeam === m.home_team_id ? m.away_team_id : m.home_team_id) : draft.forTeam;
    const type: EventType = draft.kind === 'goal' ? (draft.ownGoal ? 'own_goal' : 'goal') : draft.type;
    const minute = draft.minute === '' ? null : Number(draft.minute);
    if (minute != null && (isNaN(minute) || minute < 0 || minute > 60)) return toast('Minute must be 0–60.', true);
    const s = susp.get(draft.player);
    if (s && (s.kind === 'expelled' || (s.active && s.servesMatchId === m.id))) {
      if (!(await confirmDialog({ title: 'PLAYER UNAVAILABLE', body: `${player(draft.player)?.name} is ${s.kind === 'expelled' ? 'EXPELLED from the tournament' : 'SUSPENDED for this match'}. Record anyway?`, danger: true, confirmLabel: 'RECORD ANYWAY' }))) return;
    }
    const ok = await run(() => sb.rpc('admin_event_save', {
      p_id: draft.id, p_match: m.id, p_type: type, p_team: playerTeam, p_player: draft.player,
      p_assist: type === 'goal' && draft.assist ? draft.assist : null, p_minute: minute, p_note: null,
    }), draft.kind === 'goal' ? 'Goal saved ⚽' : 'Card saved');
    if (ok) setDraft(null);
  };

  const teamColumn = (t: Team | undefined, side: 'home' | 'away') => {
    if (!t) return <div className="split-half"><p style={{ color: 'var(--text-muted)' }}>Team not assigned yet ({placeholderName(side === 'home' ? m.home_placeholder : m.away_placeholder)}).</p></div>;
    const other = side === 'home' ? m.away_team_id : m.home_team_id;
    const goals = evs.filter((e) => (e.type === 'goal' && e.team_id === t.id) || (e.type === 'own_goal' && e.team_id === other));
    const cards = evs.filter((e) => e.team_id === t.id && e.type !== 'goal' && e.type !== 'own_goal');
    const row = (e: MatchEvent, label: React.ReactNode) => (
      <div key={e.id} className="ev-row">
        <span className="ev-min">{e.minute != null ? `${e.minute}′` : '–'}</span>
        <span className="ev-txt">{label}</span>
        {isScorer && !locked && (
          <span className="ev-act">
            <button type="button" className="ev-btn" disabled={busy} onClick={() => editEvent(e)} aria-label="Edit">✎</button>
            <button type="button" className="ev-btn bad" disabled={busy} onClick={() => delEvent(e)} aria-label="Remove">✕</button>
          </span>
        )}
      </div>
    );
    return (
      <div className="split-half">
        <div className="split-team"><TeamCrest team={t} size={34} /><strong>{t.display_name}</strong><span className="split-score">{side === 'home' ? m.home_score : m.away_score}</span></div>
        <div className="split-actions">
          <button type="button" className="btn-skew btn-lime" disabled={!canEvents || busy} onClick={() => openGoal(t.id)}><span>⚽ + GOAL</span></button>
          <button type="button" className="btn-skew btn-cyan-outline" disabled={!canEvents || busy} onClick={() => openCard(t.id)}><span>🟨 + CARD</span></button>
        </div>
        <div className="split-label">⚽ GOAL SCORERS</div>
        {goals.length === 0 ? <div className="ev-empty">No goals</div> : goals.map((e) => row(e, <><strong>{player(e.player_id)?.name}</strong>{e.type === 'own_goal' ? ' (OG)' : ''}{e.assist_player_id && <span className="ev-sub"> · assist {player(e.assist_player_id)?.name}</span>}</>))}
        <div className="split-label">🟨 CARD HOLDERS</div>
        {cards.length === 0 ? <div className="ev-empty">No cards</div> : cards.map((e) => row(e, <>{cardIcon(e.type)} <strong>{player(e.player_id)?.name}</strong>{e.type === 'red_violent' && <span className="ev-sub"> · expelled</span>}</>))}
        <details className="split-squad">
          <summary>SQUAD ({roster(t.id).length})</summary>
          <div style={{ display: 'grid', gap: '0.25rem', marginTop: '0.4rem' }}>{roster(t.id).map((p) => <PlayerRow key={p.id} p={p} m={m} evs={evs} susp={susp.get(p.id)} />)}</div>
        </details>
      </div>
    );
  };

  const draftTeam = draft ? team(draft.forTeam) : undefined;
  const scorerPool = draft ? roster(draft.kind === 'goal' && draft.ownGoal ? (draft.forTeam === m.home_team_id ? m.away_team_id : m.home_team_id) : draft.forTeam) : [];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Link href="/admin/matches" style={{ color: 'var(--cyan)', fontFamily: 'var(--font-sport)', fontSize: '0.82rem' }}>← ALL MATCHES</Link>
        <Link href={`/matches/${m.id}`} target="_blank" style={{ color: 'var(--cyan)', fontFamily: 'var(--font-sport)', fontSize: '0.82rem' }}>PUBLIC PAGE ↗</Link>
      </div>

      <section className={`ws-card lime-bottom match-hero ${m.status === 'live' ? 'is-live' : ''}`} style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span className={`badge-skew ${isKO ? 'badge-ko' : g === 'A' ? 'badge-group-a' : 'badge-group-b'}`}>{stageLabel(m, g)} · M{String(m.match_no).padStart(2, '0')}</span>
          <span className={`status-pill ${status === 'LIVE' ? 'status-live' : status === 'FT' || status === 'FULL TIME' ? 'status-finished' : 'status-upcoming'}`}>{status === 'FT' ? 'FINALIZED' : status}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtTimeAmPm(m.scheduled_at)}</span>
        </div>
        <div className="match-hero-row">
          <div className="match-hero-team"><BigLogo team={home} size={64} label={m.home_placeholder ?? ''} /><span className="name">{home?.display_name ?? placeholderName(m.home_placeholder)}</span></div>
          <div>
            <div className="score-big" style={{ color: '#fff' }}>{m.home_score}<span style={{ color: 'var(--cyan)' }}> — </span>{m.away_score}</div>
            {isKO && m.pen_home != null && m.pen_away != null && <div style={{ color: 'var(--lime)', fontFamily: 'var(--font-sport)', fontWeight: 700 }}>({m.pen_home}–{m.pen_away} pens)</div>}
            {m.result_type !== 'normal' && <div style={{ color: 'var(--warning)', fontFamily: 'var(--font-sport)', fontSize: '0.8rem' }}>{m.result_type.replace('_', ' ').toUpperCase()}</div>}
          </div>
          <div className="match-hero-team"><BigLogo team={away} size={64} label={m.away_placeholder ?? ''} /><span className="name">{away?.display_name ?? placeholderName(m.away_placeholder)}</span></div>
        </div>
        {m.details_incomplete && (
          <div style={{ marginTop: '0.6rem', color: 'var(--warning)', fontSize: '0.84rem' }}>
            ⚠ Details incomplete: {m.events_home + m.events_away} goals recorded of {m.home_score + m.away_score} (manual score {m.manual_home}–{m.manual_away}). Add the missing goals; the flag clears automatically.
          </div>
        )}
        {isScorer && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
            {(m.status === 'scheduled' || m.status === 'postponed') && !locked && (
              <button type="button" className="btn-skew btn-lime" style={{ minHeight: 48 }} disabled={busy || !home || !away}
                onClick={() => action('start', 'START MATCH', { title: 'START MATCH', body: <>Kick off <strong>{home?.display_name} vs {away?.display_name}</strong>? It shows as LIVE on the public site immediately.</> })}><span>▶ START MATCH</span></button>
            )}
            {m.status === 'live' && (
              <button type="button" className="btn-skew btn-danger-outline" style={{ minHeight: 48 }} disabled={busy}
                onClick={() => action('end', 'END MATCH', { title: 'FULL TIME', body: <>End the match at <strong>{m.home_score}–{m.away_score}</strong>? You can still edit events until it is finalized.</> })}><span>⏹ END MATCH (FULL TIME)</span></button>
            )}
            {!locked && (m.status === 'full_time' || m.result_type !== 'normal') && (
              <button type="button" className="btn-skew btn-lime" style={{ minHeight: 48 }} disabled={busy}
                onClick={() => {
                  if (isKO && !matchWinnerId(m)) { toast('Knockout is level — enter the penalty shootout (Match details) before finalizing.', true); setShowDetails(true); return; }
                  void action('finalize', 'FINALIZE RESULT', { title: 'FINALIZE RESULT', body: <>Finalize <strong>{home?.display_name} {m.home_score}–{m.away_score} {away?.display_name}</strong>{isKO && m.pen_home != null ? ` (${m.pen_home}–${m.pen_away} pens)` : ''}? It will count in {isKO ? 'the bracket' : 'the standings'}.</> });
                }}><span>✅ FINALIZE RESULT</span></button>
            )}
            {(locked || m.status === 'full_time') && (
              <button type="button" className="btn-skew btn-cyan-outline" style={{ minHeight: 48 }} disabled={busy}
                onClick={() => action('reopen', 'REOPEN', { title: 'REOPEN MATCH', danger: true, body: locked ? <>Reopen this finalized match? It stops counting in standings/bracket until finalized again.{m.stage === 'group' ? ' If the semifinals are already set you will be asked to review the bracket.' : ''}</> : 'Put this match back to LIVE?' })}><span>↺ REOPEN</span></button>
            )}
            {m.status === 'live' && evs.length === 0 && (
              <button type="button" className="btn-skew btn-cyan-outline" disabled={busy} onClick={() => action('unstart', 'UNDO START', { title: 'UNDO START', body: 'Set this match back to scheduled (only possible with no events)?' })}><span>UNDO START</span></button>
            )}
            <button type="button" className="btn-skew btn-cyan-outline" onClick={() => setShowDetails((v) => !v)}><span>⚙ MATCH DETAILS</span></button>
          </div>
        )}
        {!canEvents && isScorer && !locked && m.status === 'scheduled' && <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Start the match to record goals and cards.</div>}
        {locked && <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Finalized — reopen to change events or the result. Ratings, MVP and the publish toggle stay editable.</div>}
      </section>

      {showDetails && <DetailsPanel m={m} home={home} away={away} maxAdded={maxAdded} patch={patch} busy={busy} roster={roster} />}

      <section className="ws-card split-board" style={{ marginBottom: '1rem' }}>
        {teamColumn(home, 'home')}
        <div className="split-divider" aria-hidden />
        {teamColumn(away, 'away')}
      </section>

      {isScorer && home && away && <RatingsPanel m={m} home={home} away={away} roster={roster} patch={patch} busy={busy} />}
      {isScorer && home && away && <LineupPanel m={m} teams={[home, away]} roster={roster} />}

      {draft && (
        <div className="modal-backdrop open" style={{ display: 'flex' }} role="dialog" aria-modal="true">
          <div className="modal-panel" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">{draft.kind === 'goal' ? `⚽ ${draft.editing ? 'EDIT' : 'ADD'} GOAL — ${draftTeam?.display_name}` : `🟨 ${draft.editing ? 'EDIT' : 'ADD'} CARD — ${draftTeam?.display_name}`}</div>
              <button type="button" className="close-btn" onClick={() => setDraft(null)}>×</button>
            </div>
            {draft.kind === 'goal' && (
              <>
                <label className="form-label">GOAL FOR</label>
                <div className="filter-bar" style={{ marginBottom: '0.6rem' }}>
                  {[home!, away!].map((t) => (
                    <button key={t.id} type="button" className={`filter-btn ${draft.forTeam === t.id ? 'active' : ''}`} onClick={() => setDraft({ ...draft, forTeam: t.id, player: '', assist: '' })}><span>{t.display_name}</span></button>
                  ))}
                </div>
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.7rem', fontSize: '0.85rem', minHeight: 32 }}>
                  <input type="checkbox" checked={draft.ownGoal} onChange={(e) => setDraft({ ...draft, ownGoal: e.target.checked, player: '', assist: '' })} style={{ width: 20, height: 20, accentColor: 'var(--lime)' }} />
                  Own goal (scored by a {team(draft.forTeam === m.home_team_id ? m.away_team_id : m.home_team_id)?.display_name} player)
                </label>
              </>
            )}
            {draft.kind === 'card' && (
              <>
                <label className="form-label">CARD</label>
                <div style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.7rem' }}>
                  {(['yellow', 'second_yellow', 'red', 'red_violent'] as EventType[]).map((c) => (
                    <button key={c} type="button" className={`filter-btn ${draft.type === c ? 'active' : ''}`} style={{ justifyContent: 'flex-start', minHeight: 44 }} onClick={() => setDraft({ ...draft, type: c })}><span>{CARD_LABEL[c]}</span></button>
                  ))}
                </div>
              </>
            )}
            <label className="form-label">{draft.kind === 'goal' ? (draft.ownGoal ? 'OWN-GOAL BY' : 'SCORER') : 'PLAYER'}</label>
            <div className="player-chip-grid" style={{ marginBottom: '0.7rem' }}>
              {scorerPool.map((p) => {
                const s = susp.get(p.id);
                const out = s && (s.kind === 'expelled' || (s.active && s.servesMatchId === m.id));
                return (
                  <button key={p.id} type="button" className="player-tap-chip" onClick={() => setDraft({ ...draft, player: p.id, assist: draft.assist === p.id ? '' : draft.assist })}
                    style={{ minHeight: 44, ...(draft.player === p.id ? { background: 'var(--lime)', color: 'var(--ink)', borderColor: 'var(--lime)' } : {}), ...(out ? { opacity: 0.45 } : {}) }}>
                    {p.jersey != null ? `#${p.jersey} ` : ''}{p.name}{out ? (s!.kind === 'expelled' ? ' ⛔' : ' ⚠') : ''}
                  </button>
                );
              })}
            </div>
            {draft.kind === 'goal' && !draft.ownGoal && (
              <>
                <label className="form-label">ASSIST</label>
                <div className="player-chip-grid" style={{ marginBottom: '0.7rem' }}>
                  <button type="button" className="player-tap-chip" onClick={() => setDraft({ ...draft, assist: '' })} style={{ minHeight: 44, ...(draft.assist === '' ? { background: 'var(--cyan)', color: 'var(--ink)' } : {}) }}>No assist</button>
                  {scorerPool.filter((p) => p.id !== draft.player).map((p) => (
                    <button key={p.id} type="button" className="player-tap-chip" onClick={() => setDraft({ ...draft, assist: p.id })} style={{ minHeight: 44, ...(draft.assist === p.id ? { background: 'var(--cyan)', color: 'var(--ink)' } : {}) }}>
                      {p.jersey != null ? `#${p.jersey} ` : ''}{p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <label className="form-label">MINUTE (OPTIONAL)</label>
            <input className="form-input" inputMode="numeric" pattern="[0-9]*" value={draft.minute} onChange={(e) => setDraft({ ...draft, minute: e.target.value.replace(/\D/g, '').slice(0, 2) })} style={{ marginBottom: '1rem', maxWidth: 120 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn-skew btn-cyan-outline" onClick={() => setDraft(null)} style={{ minHeight: 44 }}><span>CANCEL</span></button>
              <button type="button" className="btn-skew btn-lime" onClick={saveDraft} disabled={busy || !draft.player} style={{ minHeight: 44 }}><span>{busy ? 'SAVING…' : 'SAVE'}</span></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlayerRow({ p, m, evs, susp }: { p: Player; m: Match; evs: MatchEvent[]; susp?: ReturnType<typeof computeSuspensions> extends Map<string, infer S> ? S : never }) {
  const goals = evs.filter((e) => e.type === 'goal' && e.player_id === p.id).length;
  const og = evs.filter((e) => e.type === 'own_goal' && e.player_id === p.id).length;
  const assists = evs.filter((e) => e.assist_player_id === p.id).length;
  const cards = evs.filter((e) => e.player_id === p.id && !['goal', 'own_goal'].includes(e.type));
  const out = susp && (susp.kind === 'expelled' || (susp.active && susp.servesMatchId === m.id));
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,.05)', opacity: out ? 0.45 : 1 }}>
      <span>
        <span style={{ color: 'var(--lime)', fontFamily: 'var(--font-display)', display: 'inline-block', minWidth: 22 }}>{p.jersey ?? '–'}</span> {p.name}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}> {POS[p.position]}</span>
        {susp?.kind === 'expelled' && <span className="mini-tag tag-exp" style={{ marginLeft: 4 }}>EXPELLED</span>}
        {susp?.kind === 'suspended' && susp.active && <span className="mini-tag tag-susp" style={{ marginLeft: 4 }}>{susp.servesMatchId === m.id ? 'SUSPENDED THIS MATCH' : 'SUSPENDED NEXT'}</span>}
      </span>
      <span style={{ whiteSpace: 'nowrap' }}>{'⚽'.repeat(goals)}{og ? ` OG×${og}` : ''}{assists ? ` 🅰️${assists}` : ''} {cards.map((c) => cardIcon(c.type)).join('')}</span>
    </div>
  );
}

function DetailsPanel({ m, home, away, maxAdded, patch, busy, roster }: {
  m: Match; home?: Team; away?: Team; maxAdded: number; busy: boolean;
  patch: (p: Record<string, unknown>, msg?: string) => Promise<boolean>; roster: (tid: string | null) => Player[];
}) {
  const isKO = m.stage !== 'group';
  const [manH, setManH] = useState(m.manual_home?.toString() ?? '');
  const [manA, setManA] = useState(m.manual_away?.toString() ?? '');
  const [penH, setPenH] = useState(m.pen_home?.toString() ?? '');
  const [penA, setPenA] = useState(m.pen_away?.toString() ?? '');
  const [reason, setReason] = useState(m.decision_reason ?? '');
  const [note, setNote] = useState(m.note ?? '');
  const { toast } = useAdmin();
  const num = (s: string) => (s === '' ? null : Number(s));
  const hasGoalEvents = m.events_home + m.events_away > 0;
  const locked = m.finalized;

  return (
    <div className="ws-card" style={{ marginBottom: '1rem', display: 'grid', gap: '1rem' }}>
      <div className="rule-sec-title"><span>⚙ MATCH DETAILS</span></div>
      <div className="grid-2">
        <div>
          <label className="form-label">ADDED TIME (MAX {maxAdded} MIN)</label>
          <div className="filter-bar">
            {Array.from({ length: maxAdded + 1 }, (_, i) => i).map((i) => (
              <button key={i} type="button" className={`filter-btn ${m.added_minutes === i ? 'active' : ''}`} disabled={busy || locked} onClick={() => patch({ added_minutes: i })}><span>+{i}′</span></button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">VAR APPEALS USED (MAX 2 EACH)</label>
          {(['home', 'away'] as const).map((side) => (
            <div key={side} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '0.3rem' }}>
              <span style={{ minWidth: 48, fontSize: '0.8rem' }}>{(side === 'home' ? home : away)?.short_code}</span>
              {[0, 1, 2].map((n) => (
                <button key={n} type="button" className={`filter-btn ${(side === 'home' ? m.var_home : m.var_away) === n ? 'active' : ''}`} disabled={busy || locked} onClick={() => patch({ [`var_${side}`]: n })}><span>{n}</span></button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="form-label">RESULT TYPE</label>
        <div className="filter-bar">
          {[['normal', 'Normal'], ['walkover_home', `Walkover → ${home?.short_code ?? 'home'}`], ['walkover_away', `Walkover → ${away?.short_code ?? 'away'}`], ['abandoned', 'Abandoned']].map(([v, l]) => (
            <button key={v} type="button" className={`filter-btn ${m.result_type === v ? 'active' : ''}`} disabled={busy || locked}
              onClick={async () => {
                if (v !== 'normal' && !(await confirmDialog({ title: 'CHANGE RESULT TYPE', body: v === 'abandoned' ? 'Abandoned: enter the organisers’ result as a manual score below, with a note.' : `Walkover: recorded as ${v === 'walkover_home' ? '3–0' : '0–3'} (configurable). No goals are credited to players.` }))) return;
                await patch({ result_type: v });
              }}><span>{l}</span></button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div>
          <label className="form-label">MANUAL SCORE {m.score_mode === 'manual' ? '(ACTIVE — details incomplete)' : '(reconciliation / abandoned)'}</label>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input className="form-input" inputMode="numeric" style={{ width: 64 }} value={manH} onChange={(e) => setManH(e.target.value.replace(/\D/g, ''))} disabled={locked} />
            <span>–</span>
            <input className="form-input" inputMode="numeric" style={{ width: 64 }} value={manA} onChange={(e) => setManA(e.target.value.replace(/\D/g, ''))} disabled={locked} />
            <button type="button" className="btn-skew btn-cyan-outline" disabled={busy || locked || manH === '' || manA === ''}
              onClick={async () => {
                let confirm = false;
                if (hasGoalEvents) {
                  if (!(await confirmDialog({ title: 'OVERRIDE EVENT SCORE', danger: true, body: `Goal events already give ${m.events_home}–${m.events_away}. Set a manual score of ${manH}–${manA}? The match is flagged "details incomplete" until events match.` }))) return;
                  confirm = true;
                }
                await patch({ score_mode: 'manual', manual_home: num(manH), manual_away: num(manA), confirm_override: confirm }, 'Manual score set');
              }}><span>SET</span></button>
            {m.score_mode === 'manual' && <button type="button" className="btn-skew btn-cyan-outline" disabled={busy || locked} onClick={() => patch({ score_mode: 'events' }, 'Back to event scoring')}><span>USE EVENTS</span></button>}
          </div>
        </div>
        {isKO && (
          <div>
            <label className="form-label">PENALTY SHOOTOUT (4 KICKS + SUDDEN DEATH)</label>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input className="form-input" inputMode="numeric" style={{ width: 64 }} value={penH} onChange={(e) => setPenH(e.target.value.replace(/\D/g, ''))} disabled={locked} />
              <span>–</span>
              <input className="form-input" inputMode="numeric" style={{ width: 64 }} value={penA} onChange={(e) => setPenA(e.target.value.replace(/\D/g, ''))} disabled={locked} />
              <button type="button" className="btn-skew btn-lime" disabled={busy || locked} onClick={() => {
                if (penH !== '' && penH === penA) return toast('A shootout cannot end level.', true);
                void patch({ pen_home: num(penH), pen_away: num(penA) }, 'Shootout saved');
              }}><span>SAVE</span></button>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Shootout goals never count in player stats.</div>
          </div>
        )}
      </div>

      {isKO && (
        <div>
          <label className="form-label">EMERGENCY: ORGANIZER-DECIDED WINNER (REASON REQUIRED)</label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="form-input" placeholder="Reason (e.g. walkover, abandoned)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: '1 1 220px' }} disabled={locked} />
            {[home, away].filter(Boolean).map((t) => (
              <button key={t!.id} type="button" className={`filter-btn ${m.decided_winner_id === t!.id ? 'active' : ''}`} disabled={busy || locked || !reason.trim()}
                onClick={async () => { if (await confirmDialog({ title: 'ORGANIZER DECISION', danger: true, body: `Declare ${t!.display_name} the winner? Reason: ${reason}` })) await patch({ decided_winner_id: t!.id, decision_reason: reason }); }}><span>{t!.short_code} WINS</span></button>
            ))}
            {m.decided_winner_id && <button type="button" className="filter-btn" disabled={busy || locked} onClick={() => patch({ decided_winner_id: null, decision_reason: null })}><span>CLEAR</span></button>}
          </div>
        </div>
      )}

      <div className="grid-2">
        <div>
          <label className="form-label">MATCH MVP</label>
          <select className="form-select" value={m.mvp_player_id ?? ''} disabled={busy} onChange={(e) => patch({ mvp_player_id: e.target.value || null }, 'MVP saved')}>
            <option value="">— none —</option>
            {[home, away].filter(Boolean).map((t) => (
              <optgroup key={t!.id} label={t!.display_name}>{roster(t!.id).map((p) => <option key={p.id} value={p.id}>{p.jersey != null ? `#${p.jersey} ` : ''}{p.name}</option>)}</optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">NOTE (SHOWN FOR WALKOVER / ABANDONED)</label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input className="form-input" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="button" className="btn-skew btn-cyan-outline" disabled={busy} onClick={() => patch({ note: note || null })}><span>SAVE</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RatingsPanel({ m, home, away, roster, patch, busy }: {
  m: Match; home: Team; away: Team; roster: (tid: string | null) => Player[]; busy: boolean;
  patch: (p: Record<string, unknown>, msg?: string) => Promise<boolean>;
}) {
  const snap = useSnap();
  const { toast } = useAdmin();
  const { busy: saving, run } = useAction();
  const sb = supabaseBrowser();
  const saved = useMemo(() => Object.fromEntries(snap.ratings.filter((r) => r.match_id === m.id).map((r) => [r.player_id, r.rating])), [snap.ratings, m.id]);
  const avg = useMemo(() => {
    const out: Record<string, { avg: number; n: number }> = {};
    for (const r of snap.ratings) { const o = (out[r.player_id] ??= { avg: 0, n: 0 }); o.avg = (o.avg * o.n + Number(r.rating)) / (o.n + 1); o.n++; }
    return out;
  }, [snap.ratings]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const value = (pid: string) => draft[pid] ?? (saved[pid] != null ? String(saved[pid]) : '');
  const dirty = Object.keys(draft).filter((pid) => draft[pid] !== (saved[pid] != null ? String(saved[pid]) : ''));
  const step = (pid: string, d: number) => {
    const cur = value(pid) === '' ? 6 : Number(value(pid));
    setDraft({ ...draft, [pid]: String(Math.min(10, Math.max(0, Math.round((cur + d) * 10) / 10))) });
  };
  const saveAll = async () => {
    for (const pid of dirty) {
      const v = draft[pid].trim();
      if (v !== '' && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 10)) return toast(`${snap.players.find((p) => p.id === pid)?.name}: rating must be 0–10`, true);
    }
    const ok = await run(async () => {
      for (const pid of dirty) {
        const v = draft[pid].trim();
        const r = await sb.rpc('admin_rating_set', { p_match: m.id, p_player: pid, p_rating: v === '' ? null : Math.round(Number(v) * 10) / 10 });
        if (r.error) return r;
      }
    }, `${dirty.length} rating${dirty.length === 1 ? '' : 's'} saved`);
    if (ok) setDraft({});
  };
  return (
    <div className="ws-card" style={{ marginBottom: '1rem' }}>
      <div className="rule-sec-title">
        <span>⭐ PLAYER RATINGS — THIS MATCH ({Object.keys(saved).length} rated)</span>
        <button type="button" className={`filter-btn ${m.ratings_published ? 'active' : ''}`} disabled={busy} onClick={() => patch({ ratings_published: !m.ratings_published }, m.ratings_published ? 'Ratings hidden from public' : 'Ratings published')}>
          <span>{m.ratings_published ? 'PUBLIC ✓' : 'HIDDEN FROM PUBLIC'}</span>
        </button>
      </div>
      <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>0–10, one decimal. Use − / + (0.5 steps) or type. Leave empty for players who weren&apos;t rated. “Avg” = tournament average over rated matches.</p>
      <div className="split-board">
        {[home, away].map((t, i) => (
          <div key={t.id} className="split-half" style={i === 1 ? { gridColumn: 3 } : undefined}>
            <div className="split-label" style={{ marginTop: 0 }}>{t.display_name}</div>
            {roster(t.id).map((p) => {
              const changed = dirty.includes(p.id);
              return (
                <div key={p.id} className="rate-row">
                  <span className="rate-name">{p.jersey ?? '–'} {p.name}</span>
                  <span className="rate-avg">{avg[p.id] ? `avg ${avg[p.id].avg.toFixed(1)} (${avg[p.id].n})` : ''}</span>
                  <button type="button" className="ev-btn" onClick={() => step(p.id, -0.5)} aria-label="minus">−</button>
                  <input className="form-input rate-input" inputMode="decimal" placeholder="—" value={value(p.id)} style={changed ? { borderColor: 'var(--lime)' } : undefined}
                    onChange={(e) => setDraft({ ...draft, [p.id]: e.target.value.replace(/[^\d.]/g, '').slice(0, 4) })} />
                  <button type="button" className="ev-btn" onClick={() => step(p.id, 0.5)} aria-label="plus">+</button>
                </div>
              );
            })}
          </div>
        ))}
        <div className="split-divider" aria-hidden style={{ gridColumn: 2, gridRow: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn-skew btn-lime" style={{ minHeight: 48 }} disabled={saving || dirty.length === 0} onClick={saveAll}><span>{saving ? 'SAVING…' : `SAVE ${dirty.length || ''} RATING${dirty.length === 1 ? '' : 'S'}`}</span></button>
        {dirty.length > 0 && <button type="button" className="btn-skew btn-cyan-outline" onClick={() => setDraft({})}><span>DISCARD</span></button>}
      </div>
    </div>
  );
}

function LineupPanel({ m, teams, roster }: { m: Match; teams: Team[]; roster: (tid: string | null) => Player[] }) {
  const snap = useSnap();
  const { busy, run } = useAction();
  const sb = supabaseBrowser();
  const [open, setOpen] = useState(false);
  const current = (tid: string) => {
    const rows = snap.lineups.filter((l) => l.match_id === m.id && l.team_id === tid).map((l) => l.player_id);
    return new Set(rows.length ? rows : roster(tid).map((p) => p.id));
  };
  const [sel, setSel] = useState<Record<string, Set<string>>>(() => Object.fromEntries(teams.map((t) => [t.id, current(t.id)])));
  return (
    <div className="ws-card" style={{ marginBottom: '1rem' }}>
      <div className="rule-sec-title"><span>👥 WHO PLAYED (MATCHES PLAYED STAT · DEFAULT: WHOLE ROSTER)</span><button type="button" className="filter-btn" onClick={() => setOpen((v) => !v)}><span>{open ? 'HIDE' : 'EDIT'}</span></button></div>
      {open && (
        <div className="grid-2">
          {teams.map((t) => (
            <div key={t.id}>
              <div style={{ fontFamily: 'var(--font-sport)', color: 'var(--cyan)', fontWeight: 800, marginBottom: '0.3rem' }}>{t.display_name}</div>
              {roster(t.id).map((p) => (
                <label key={p.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', minHeight: 34 }}>
                  <input type="checkbox" style={{ width: 20, height: 20, accentColor: 'var(--lime)' }} checked={sel[t.id]?.has(p.id) ?? false}
                    onChange={(e) => setSel((s) => { const n = new Set(s[t.id]); if (e.target.checked) n.add(p.id); else n.delete(p.id); return { ...s, [t.id]: n }; })} />
                  {p.jersey ?? '–'} {p.name}
                </label>
              ))}
              <button type="button" className="btn-skew btn-cyan-outline" style={{ marginTop: '0.4rem' }} disabled={busy}
                onClick={() => run(() => sb.rpc('admin_lineup_set', { p_match: m.id, p_team: t.id, p_players: [...(sel[t.id] ?? [])] }), 'Lineup saved')}><span>SAVE {t.short_code}</span></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
