'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { useAdmin } from '@/components/admin/AdminContext';
import { TeamCrest, fmtTimeAmPm, placeholderName } from '@/components/public/bits';
import { computeGroupTable, displayStatus } from '@/lib/tournament';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Dashboard() {
  const snap = useSnap();
  const { can } = useAdmin();
  const t = (id: string | null) => snap.teams.find((x) => x.id === id);
  const sorted = [...snap.matches].sort((a, b) => a.match_no - b.match_no);
  const live = sorted.filter((m) => m.status === 'live');
  const next = sorted.find((m) => m.status === 'scheduled' || m.status === 'postponed');
  const toFinalize = sorted.filter((m) => m.status === 'full_time' && !m.finalized);
  const done = sorted.filter((m) => m.finalized).length;
  const tables = useMemo(() => snap.groups.map((g) => computeGroupTable(snap, g.id)), [snap]);
  const [flags, setFlags] = useState<{ name: string; team: string; age: number }[]>([]);
  useEffect(() => {
    if (!can('owner') && !can('viewer')) return;
    void supabaseBrowser().from('player_private').select('player_id, age').gte('age', 24).then(({ data }) => {
      setFlags((data ?? []).map((r) => {
        const p = snap.players.find((x) => x.id === r.player_id);
        return { name: p?.name ?? '?', team: t(p?.team_id ?? null)?.display_name ?? '?', age: r.age as number };
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.players.length]);

  const warnings: { text: string; href?: string }[] = [];
  toFinalize.forEach((m) => warnings.push({ text: `M${String(m.match_no).padStart(2, '0')} is at full time but not finalized — standings ignore it until finalized.`, href: `/admin/matches/${m.id}` }));
  sorted.filter((m) => m.details_incomplete).forEach((m) => warnings.push({ text: `M${String(m.match_no).padStart(2, '0')}: details incomplete (${m.events_home + m.events_away} of ${m.home_score + m.away_score} goals recorded).`, href: `/admin/matches/${m.id}` }));
  tables.filter((g) => g.complete && g.unresolved).forEach((g) => warnings.push({ text: `Group ${g.code}: tie needs organizer decision (set lot ranks).`, href: '/admin/knockout' }));
  if (snap.tournament.bracket_needs_review) warnings.push({ text: 'A group result changed after the semifinals were set — review the bracket.', href: '/admin/knockout' });
  if (tables.every((g) => g.complete) && !snap.matches.find((m) => m.code === 'SF1')?.home_team_id) warnings.push({ text: 'All group matches are final — confirm standings and generate the semifinals.', href: '/admin/knockout' });
  if (flags.length) warnings.push({ text: `${flags.length} player(s) are 24+ (rule: under 24): ${flags.map((f) => `${f.name} (${f.team}, ${f.age})`).join(', ')}`, href: '/admin/teams' });

  const card = (m: (typeof sorted)[number], label: string) => (
    <div className="ws-card lime-bottom">
      <div className="section-kicker">{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.5rem 0', flexWrap: 'wrap' }}>
        <TeamCrest team={t(m.home_team_id)} label={m.home_placeholder ?? '?'} size={36} />
        <strong style={{ fontFamily: 'var(--font-display)' }}>{t(m.home_team_id)?.display_name ?? placeholderName(m.home_placeholder)}</strong>
        <span className="score-big" style={{ fontSize: '2.2rem', color: 'var(--lime)' }}>{m.status === 'scheduled' ? 'vs' : `${m.home_score} – ${m.away_score}`}</span>
        <strong style={{ fontFamily: 'var(--font-display)' }}>{t(m.away_team_id)?.display_name ?? placeholderName(m.away_placeholder)}</strong>
        <TeamCrest team={t(m.away_team_id)} label={m.away_placeholder ?? '?'} size={36} />
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: '0.6rem' }}>M{String(m.match_no).padStart(2, '0')} · {fmtTimeAmPm(m.scheduled_at)} · {displayStatus(m)}</div>
      <Link href={`/admin/matches/${m.id}`} className="btn-skew btn-lime" style={{ minHeight: 44 }}><span>⚡ OPEN MATCH CONTROL</span></Link>
    </div>
  );

  return (
    <>
      <div className="section-head">
        <div className="section-title-wrap">
          <div className="section-kicker">❄️ {snap.tournament.name.toUpperCase()} · SITE MODE: {snap.settings.site_mode.toUpperCase()}</div>
          <h2 className="section-title"><span className="word-cyan">ADMIN</span> <span className="word-lime">DASHBOARD</span></h2>
          <div className="section-underline" />
        </div>
      </div>
      <div className="hero-stat-strip" style={{ marginBottom: '1.25rem' }}>
        <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">{snap.teams.length}</div><div className="hero-stat-lbl">TEAMS</div></div></div>
        <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">{done} / {sorted.length}</div><div className="hero-stat-lbl">MATCHES FINAL</div></div></div>
        <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">{live.length}</div><div className="hero-stat-lbl">LIVE NOW</div></div></div>
        <div className="hero-stat-box"><div className="hero-stat-box-inner"><div className="hero-stat-val">{snap.players.filter((p) => p.active).length}</div><div className="hero-stat-lbl">PLAYERS</div></div></div>
      </div>
      <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
        {live.map((m) => <div key={m.id}>{card(m, '🔴 LIVE NOW')}</div>)}
        {toFinalize.slice(0, 1).map((m) => <div key={m.id}>{card(m, '✅ AWAITING FINALIZE')}</div>)}
        {next && <div>{card(next, '⚡ NEXT MATCH')}</div>}
      </div>
      <div className="ws-card" style={{ marginBottom: '1.25rem' }}>
        <div className="rule-sec-title"><span>⚠️ WARNINGS</span><span className="badge-skew badge-ko">{warnings.length}</span></div>
        {warnings.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>All clear.</p> : (
          <ul className="rule-list">{warnings.map((w, i) => <li key={i}>{w.href ? <Link href={w.href} style={{ color: 'var(--warning)' }}>{w.text}</Link> : w.text}</li>)}</ul>
        )}
      </div>
      <Link href="/admin/matches" className="btn-skew btn-cyan-outline"><span>ALL 15 MATCHES →</span></Link>
    </>
  );
}
