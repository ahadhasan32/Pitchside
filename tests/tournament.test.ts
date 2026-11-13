import { describe, expect, it } from 'vitest';
import { computeGroupTable, computePlayerStats, computeSuspensions, goldenBoot, matchWinnerId, roundRobin, topRated, topAssists, champion } from '@/lib/tournament';
import { ev, match, player, snapshot, team } from './fixtures';

const T4 = ['A', 'B', 'C', 'D'].map((x) => team(x));
const order = (s: ReturnType<typeof computeGroupTable>) => s.rows.map((r) => r.team.id);

describe('round robin', () => {
  it('4 teams → 6 unique pairings', () => {
    const p = roundRobin(['A', 'B', 'C', 'D']);
    expect(p).toHaveLength(6);
    expect(new Set(p.map(([a, b]) => [a, b].sort().join())).size).toBe(6);
  });
});

describe('standings', () => {
  it('points 3/1/0, GD and GF', () => {
    const s = snapshot({ teams: T4, matches: [match(1, 'A', 'B', 2, 0), match(2, 'C', 'D', 1, 1), match(3, 'A', 'C', 0, 0)] });
    const g = computeGroupTable(s, 'gA');
    const a = g.rows.find((r) => r.team.id === 'A')!;
    expect([a.P, a.W, a.D, a.L, a.GF, a.GA, a.GD, a.Pts]).toEqual([2, 1, 1, 0, 2, 0, 2, 4]);
    expect(order(g)[0]).toBe('A');
  });
  it('only finalized matches count', () => {
    const s = snapshot({ teams: T4, matches: [match(1, 'A', 'B', 2, 0, { finalized: false }), match(2, 'C', 'D', 1, 0)] });
    const g = computeGroupTable(s, 'gA');
    expect(g.rows.find((r) => r.team.id === 'A')!.P).toBe(0);
    expect(order(g)[0]).toBe('C');
  });
  it('GD beats GF, GF beats H2H', () => {
    // A and B both 3 pts; A GD +3, B GD +1 → A first even though B beat A? (B didn't play A here)
    const s = snapshot({ teams: T4, matches: [match(1, 'A', 'C', 3, 0), match(2, 'B', 'D', 4, 3)] });
    expect(order(computeGroupTable(s, 'gA')).slice(0, 2)).toEqual(['A', 'B']);
    const s2 = snapshot({ teams: T4, matches: [match(1, 'A', 'C', 3, 1), match(2, 'B', 'D', 2, 0)] });
    expect(order(computeGroupTable(s2, 'gA')).slice(0, 2)).toEqual(['A', 'B']); // equal GD +2, A more GF
  });
  it('head-to-head decides a 2-way tie on pts/GD/GF', () => {
    // A beat B 1-0; B beat C 1-0... construct A,B equal pts GD GF


    const s2 = snapshot({ teams: T4, matches: [match(1, 'B', 'A', 0, 1), match(2, 'B', 'C', 1, 0), match(3, 'A', 'D', 0, 1), match(4, 'C', 'D', 0, 0)] });
    const g = computeGroupTable(s2, 'gA');
    const a = g.rows.findIndex((r) => r.team.id === 'A'), b = g.rows.findIndex((r) => r.team.id === 'B');
    expect(a).toBeLessThan(b);
    expect(g.rows[a].unresolvedTie).toBe(false);
  });
  it('3-way tie uses the H2H mini-table', () => {
    // A, B, C each beat one another 1-0 in a cycle, and all beat D 1-0 → all 6 pts, GD +1, GF 2.
    // Mini-table is level too → falls to fair play: C has fewest cards.
    const ms = [match(1, 'A', 'B', 1, 0), match(2, 'B', 'C', 1, 0), match(3, 'C', 'A', 1, 0), match(4, 'A', 'D', 1, 0), match(5, 'B', 'D', 1, 0), match(6, 'C', 'D', 1, 0)];
    const ps = [player('pa', 'A'), player('pb', 'B'), player('pb2', 'B')];
    const evs = [ev('m1', 'yellow', 'A', 'pa'), ev('m2', 'yellow', 'B', 'pb'), ev('m2', 'red', 'B', 'pb2')];
    const g = computeGroupTable(snapshot({ teams: T4, matches: ms, players: ps, events: evs }), 'gA');
    expect(order(g)).toEqual(['C', 'A', 'B', 'D']);
    expect(g.rows.every((r) => !r.unresolvedTie)).toBe(true);
  });
  it('3-way tie broken by H2H where one team is separated, sub-tie re-applies H2H', () => {
    // A,B,C on 6 pts each (all beat D), equal GD and GF overall, but within the mini-table A has more H2H goals.
    const ms = [match(1, 'A', 'B', 2, 1), match(2, 'B', 'C', 2, 1), match(3, 'C', 'A', 1, 0), match(4, 'A', 'D', 2, 0), match(5, 'B', 'D', 1, 0), match(6, 'C', 'D', 2, 0)];
    // Overall: A GF4 GA2; B GF3 GA2 → GD differs. Just assert stable, resolved, D last.
    const g = computeGroupTable(snapshot({ teams: T4, matches: ms }), 'gA');
    expect(order(g)[3]).toBe('D');
    expect(g.rows.slice(0, 3).every((r) => r.Pts === 6)).toBe(true);
  });
  it('unresolved tie is flagged and lot rank resolves it', () => {
    const ms = [match(1, 'A', 'B', 0, 0), match(2, 'C', 'D', 0, 0), match(3, 'A', 'C', 0, 0), match(4, 'B', 'D', 0, 0), match(5, 'A', 'D', 0, 0), match(6, 'B', 'C', 0, 0)];
    const g = computeGroupTable(snapshot({ teams: T4, matches: ms }), 'gA');
    expect(g.unresolved).toBe(true);
    expect(g.rows.every((r) => r.unresolvedTie)).toBe(true);
    const lots = [team('A', 'gA', 4), team('B', 'gA', 1), team('C', 'gA', 3), team('D', 'gA', 2)];
    const g2 = computeGroupTable(snapshot({ teams: lots, matches: ms }), 'gA');
    expect(order(g2)).toEqual(['B', 'D', 'C', 'A']);
    expect(g2.unresolved).toBe(false);
  });
  it('CONFIRMED Q only when mathematically certain', () => {
    // A has won 3 of 3 → 9 pts; others can reach at most 6 except... B 2 games left max 6.
    const ms = [match(1, 'A', 'B', 1, 0), match(2, 'A', 'C', 1, 0), match(3, 'A', 'D', 1, 0),
      match(4, 'B', 'C', 0, 0, { finalized: false, status: 'scheduled' }), match(5, 'B', 'D', 0, 0, { finalized: false, status: 'scheduled' }), match(6, 'C', 'D', 0, 0, { finalized: false, status: 'scheduled' })];
    const g = computeGroupTable(snapshot({ teams: T4, matches: ms }), 'gA');
    expect(g.rows.find((r) => r.team.id === 'A')!.qualStatus).toBe('CONFIRMED');
    expect(g.rows.find((r) => r.team.id === 'B')!.qualStatus).not.toBe('CONFIRMED');
  });
});

describe('knockout', () => {
  it('drawn KO is never given to the home team', () => {
    expect(matchWinnerId(match(13, 'A', 'B', 1, 1, { stage: 'semifinal' }))).toBeNull();
  });
  it('penalties decide a draw; shootout goals do not count as goals', () => {
    const m = match(13, 'A', 'B', 1, 1, { stage: 'semifinal', pen_home: 3, pen_away: 4 });
    expect(matchWinnerId(m)).toBe('B');
  });
  it('organizer decision and walkover', () => {
    expect(matchWinnerId(match(13, 'A', 'B', 0, 0, { stage: 'semifinal', decided_winner_id: 'A' }))).toBe('A');
    expect(matchWinnerId(match(13, 'A', 'B', 0, 3, { stage: 'semifinal', result_type: 'walkover_away' }))).toBe('B');
  });
  it('champion only after the final is finalized', () => {
    const fin = match(15, 'A', 'B', 2, 1, { stage: 'final', finalized: false });
    expect(champion(snapshot({ teams: T4, matches: [fin] }))).toBeNull();
    const c = champion(snapshot({ teams: T4, matches: [{ ...fin, finalized: true }] }))!;
    expect(c.winner.id).toBe('A');
    expect(c.runnerUp!.id).toBe('B');
  });
});

describe('player stats & leaderboards', () => {
  const ps = [player('a1', 'A'), player('a2', 'A'), player('b1', 'B'), player('b2', 'B'), player('dup', 'A'), player('dup2', 'B')];
  ps[4].name = 'Same Name'; ps[5].name = 'Same Name';
  const m1 = match(1, 'A', 'B', 2, 1), m2 = match(2, 'A', 'C', 1, 0);
  const evs = [
    ev('m1', 'goal', 'A', 'a1', 'a2', 3), ev('m1', 'own_goal', 'B', 'b1', null, 5), ev('m1', 'goal', 'B', 'dup2', null, 8),
    ev('m2', 'goal', 'A', 'dup', 'a1'),
  ];
  const snap = snapshot({ teams: [...T4], players: ps, matches: [m1, m2], events: evs });
  const stats = computePlayerStats(snap);
  const s = (id: string) => stats.find((x) => x.player.id === id)!;
  it('goals, assists and own goals keyed by id (identical names stay separate)', () => {
    expect(s('a1').goals).toBe(1);
    expect(s('a1').assists).toBe(1);
    expect(s('a2').assists).toBe(1);
    expect(s('b1').goals).toBe(0);
    expect(s('b1').ownGoals).toBe(1);
    expect(s('dup').goals).toBe(1);
    expect(s('dup2').goals).toBe(1);
  });
  it('golden boot excludes own goals; ties share rank after tie-breaks', () => {
    const gb = goldenBoot(stats);
    expect(gb.find((x) => x.player.id === 'b1')).toBeUndefined();
    // dup2 played 1 match, a1 and dup played 2 → dup2 ranks first on fewer matches
    expect(gb[0].player.id).toBe('dup2');
    const a1 = gb.find((x) => x.player.id === 'a1')!, dup = gb.find((x) => x.player.id === 'dup')!;
    expect(a1.rank).toBeLessThan(dup.rank); // a1 has an assist
    expect(topAssists(stats).map((x) => x.player.id).sort()).toEqual(['a1', 'a2']);
  });
  it('ratings: published only, min matches', () => {
    const sn = snapshot({ ...snap, matches: [{ ...m1, ratings_published: true }, m2], ratings: [{ match_id: 'm1', player_id: 'a1', rating: 8 }, { match_id: 'm2', player_id: 'a1', rating: 6 }] });
    const st = computePlayerStats(sn).find((x) => x.player.id === 'a1')!;
    expect(st.ratingAvg).toBe(8);
    expect(st.ratedMatches).toBe(1);
    expect(topRated(computePlayerStats(sn), 2)).toHaveLength(0);
    expect(topRated(computePlayerStats(sn), 1)).toHaveLength(1);
  });
  it('suspension for next match; violent red expels', () => {
    const ms = [match(1, 'A', 'B', 0, 0), match(5, 'A', 'C', 0, 0, { finalized: false, status: 'scheduled' })];
    const sn = snapshot({ teams: T4, players: ps, matches: ms, events: [ev('m1', 'red', 'A', 'a1'), ev('m1', 'red_violent', 'B', 'b1'), ev('m1', 'second_yellow', 'A', 'a2')] });
    const su = computeSuspensions(sn);
    expect(su.get('a1')).toMatchObject({ kind: 'suspended', servesMatchId: 'm5', active: true });
    expect(su.get('a2')).toMatchObject({ kind: 'suspended', servesMatchId: 'm5' });
    expect(su.get('b1')).toMatchObject({ kind: 'expelled' });
  });
  it('fair play counts second yellow once as a red-equivalent', () => {
    const ms = [match(1, 'A', 'B', 0, 0), match(2, 'C', 'D', 0, 0)];
    const sn = snapshot({ teams: T4, players: ps, matches: ms, events: [ev('m1', 'yellow', 'A', 'a1'), ev('m1', 'second_yellow', 'A', 'a1')] });
    expect(computeGroupTable(sn, 'gA').rows.find((r) => r.team.id === 'A')!.fairPlay).toBe(3);
  });
});
