import type { Metadata } from 'next';
import { supabaseAnon } from '@/lib/supabase/server';
import MatchView from './MatchView';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const sb = supabaseAnon();
    const { data: m } = await sb.from('matches').select('match_no, home_team_id, away_team_id, home_placeholder, away_placeholder').eq('id', id).single();
    if (!m) return { title: 'Match — Winter Showdown 2026' };
    const { data: teams } = await sb.from('teams').select('id, display_name').in('id', [m.home_team_id, m.away_team_id].filter(Boolean));
    const { data: s } = await sb.from('match_scores').select('home_score, away_score').eq('match_id', id).single();
    const n = (tid: string | null, ph: string | null) => teams?.find((t) => t.id === tid)?.display_name ?? ph ?? 'TBD';
    const title = `M${String(m.match_no).padStart(2, '0')}: ${n(m.home_team_id, m.home_placeholder)} ${s?.home_score ?? 0}–${s?.away_score ?? 0} ${n(m.away_team_id, m.away_placeholder)} | Winter Showdown 2026`;
    return { title, openGraph: { title, images: ['/brand/hero-bg.jpg'] } };
  } catch { return { title: 'Match — Winter Showdown 2026' }; }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchView id={id} />;
}
