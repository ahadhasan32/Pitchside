import type { Award, Snapshot } from './types';
import { computePlayerStats, defenceRanking, goldenBoot } from './tournament';

export const AWARD_META: Record<Award['key'], { title: string; subtitle: string; desc: string; img: string; icon: string }> = {
  winter_crown: { title: 'THE WINTER CROWN', subtitle: 'MOST VALUABLE PLAYER (MVP)', desc: 'Awarded to the most decisive all-round player across the Winter Showdown 2026.', img: '/brand/award-winter-crown.webp', icon: '👑' },
  iron_wall: { title: 'THE IRON WALL', subtitle: 'BEST DEFENDER', desc: 'Awarded to the standout defensive anchor from the stingiest backline on the turf.', img: '/brand/award-iron-wall.webp', icon: '🛡️' },
  golden_gloves: { title: 'THE GOLDEN GLOVES', subtitle: 'BEST GOALKEEPER', desc: 'Awarded to the shot-stopper with the most clean sheets and match-saving reflexes.', img: '/brand/award-golden-gloves.webp', icon: '🧤' },
  golden_boot: { title: 'THE GOLDEN BOOT', subtitle: 'TOP GOALSCORER', desc: 'Awarded to the tournament’s most clinical finisher in front of goal.', img: '/brand/award-golden-boot.webp', icon: '👟' },
};
export const AWARD_KEYS = Object.keys(AWARD_META) as Award['key'][];

export type Suggestion = { playerId: string | null; teamId: string | null; text: string };

/** Automatic award suggestions (design-v2 logic), derived from events/ratings — never stored totals. */
export function awardSuggestions(snap: Snapshot): Record<Award['key'], Suggestion> {
  const stats = computePlayerStats(snap);
  const tn = (id?: string | null) => snap.teams.find((t) => t.id === id)?.display_name ?? '';
  const boot = goldenBoot(stats);
  const topBoot = boot.filter((b) => b.rank === 1);
  const mvp = stats.filter((s) => s.mvp > 0).sort((a, b) => b.mvp - a.mvp || b.goals - a.goals)[0];
  const def = defenceRanking(snap).filter((d) => d.P > 0);
  const wall = def[0];
  const gloves = [...def].sort((a, b) => b.cleanSheets - a.cleanSheets || a.GA - b.GA)[0];
  const none = { playerId: null, teamId: null, text: 'TBD (awaiting match results)' };
  return {
    golden_boot: topBoot.length ? { playerId: topBoot[0].player.id, teamId: topBoot[0].player.team_id, text: topBoot.map((b) => `${b.player.name} (${tn(b.player.team_id)} — ${b.goals} goals)`).join(' · ') + (topBoot.length > 1 ? ' — shared' : '') } : none,
    winter_crown: mvp ? { playerId: mvp.player.id, teamId: mvp.player.team_id, text: `${mvp.player.name} (${tn(mvp.player.team_id)} — ${mvp.mvp} match MVP${mvp.mvp > 1 ? 's' : ''})` } : none,
    iron_wall: wall ? { playerId: null, teamId: wall.team.id, text: `${wall.team.display_name} — ${wall.GA} conceded in ${wall.P} (organisers name the defender)` } : none,
    golden_gloves: gloves ? { playerId: gloves.gk?.id ?? null, teamId: gloves.team.id, text: `${gloves.gk?.name ?? 'GK'} (${gloves.team.display_name} — ${gloves.cleanSheets} clean sheet${gloves.cleanSheets === 1 ? '' : 's'})` } : none,
  };
}

export function awardWinnerText(snap: Snapshot, a: Award | undefined): string | null {
  if (!a || !a.published) return null;
  const p = snap.players.find((x) => x.id === a.player_id);
  const t = snap.teams.find((x) => x.id === (a.team_id ?? p?.team_id));
  return a.label || [p?.name, t ? `(${t.display_name})` : ''].filter(Boolean).join(' ') || null;
}
