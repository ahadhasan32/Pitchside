'use client';
import { useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { useAdmin } from '@/components/admin/AdminContext';
import { confirmDialog } from '@/components/admin/Confirm';
import { useAction } from '@/components/admin/useAction';
import { supabaseBrowser } from '@/lib/supabase/client';
import { AWARD_KEYS, AWARD_META, awardSuggestions } from '@/lib/awards';
import type { Award } from '@/lib/types';

export default function AwardsAdmin() {
  const snap = useSnap();
  const { can } = useAdmin();
  const { busy, run } = useAction();
  const sb = supabaseBrowser();
  const sug = awardSuggestions(snap);
  const owner = can('owner');
  return (
    <>
      <div className="section-head"><div className="section-title-wrap"><div className="section-kicker">👑 AUTO-SUGGESTED · OVERRIDE · PUBLISH</div><h2 className="section-title"><span className="word-cyan">INDIVIDUAL</span> <span className="word-lime">AWARDS</span></h2><div className="section-underline" /></div></div>
      <div className="grid-2">
        {AWARD_KEYS.map((k) => <AwardCard key={k + JSON.stringify(snap.awards.find((a) => a.key === k) ?? {})} k={k} a={snap.awards.find((x) => x.key === k)} suggestion={sug[k]} owner={owner} busy={busy}
          save={(row) => run(() => sb.from('awards').upsert({ tournament_id: snap.tournament.id, key: k, ...row, published_at: row.published ? new Date().toISOString() : null }), row.published ? 'Published' : 'Saved')} />)}
      </div>
    </>
  );
}

function AwardCard({ k, a, suggestion, owner, busy, save }: { k: Award['key']; a?: Award; suggestion: ReturnType<typeof awardSuggestions>[Award['key']]; owner: boolean; busy: boolean; save: (r: { player_id: string | null; team_id: string | null; label: string | null; published: boolean }) => Promise<boolean> }) {
  const snap = useSnap();
  const meta = AWARD_META[k];
  const [player, setPlayer] = useState(a?.player_id ?? suggestion.playerId ?? '');
  const [teamId, setTeamId] = useState(a?.team_id ?? suggestion.teamId ?? '');
  const [label, setLabel] = useState(a?.label ?? '');
  const row = (published: boolean) => ({ player_id: player || null, team_id: teamId || (snap.players.find((p) => p.id === player)?.team_id ?? null), label: label || null, published });
  return (
    <div className="ws-card chamfer lime-bottom">
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.6rem' }}>
        <img src={meta.img} alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} />
        <div><div style={{ fontFamily: 'var(--font-display)', color: 'var(--lime)' }}>{meta.title}</div><div style={{ fontSize: '0.72rem', color: 'var(--cyan)' }}>{meta.subtitle}</div></div>
        <span className="badge-skew badge-ko" style={{ marginLeft: 'auto' }}>{a?.published ? 'PUBLISHED' : 'NOT PUBLISHED'}</span>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-soft)', marginBottom: '0.6rem' }}>⚡ Suggestion: <strong>{suggestion.text}</strong></div>
      <label className="form-label">WINNER (PLAYER)</label>
      <select className="form-select" value={player} disabled={!owner} onChange={(e) => setPlayer(e.target.value)} style={{ marginBottom: '0.4rem' }}>
        <option value="">— none —</option>
        {snap.teams.map((t) => <optgroup key={t.id} label={t.display_name}>{snap.players.filter((p) => p.team_id === t.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>)}
      </select>
      <label className="form-label">TEAM (OPTIONAL, E.G. IRON WALL)</label>
      <select className="form-select" value={teamId} disabled={!owner} onChange={(e) => setTeamId(e.target.value)} style={{ marginBottom: '0.4rem' }}>
        <option value="">— from player —</option>{snap.teams.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
      </select>
      <label className="form-label">CUSTOM LABEL (OPTIONAL)</label>
      <input className="form-input" value={label} disabled={!owner} onChange={(e) => setLabel(e.target.value)} placeholder="Overrides the displayed text" style={{ marginBottom: '0.6rem' }} />
      {owner && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-skew btn-cyan-outline" disabled={busy} onClick={() => save(row(a?.published ?? false))}><span>SAVE</span></button>
          {!a?.published
            ? <button type="button" className="btn-skew btn-lime" disabled={busy || (!player && !teamId && !label)} onClick={async () => { if (await confirmDialog({ title: 'PUBLISH AWARD', body: `Publish ${meta.title} as final on the public site?` })) await save(row(true)); }}><span>PUBLISH</span></button>
            : <button type="button" className="btn-skew btn-danger-outline" disabled={busy} onClick={() => save(row(false))}><span>UNPUBLISH</span></button>}
        </div>
      )}
    </div>
  );
}
