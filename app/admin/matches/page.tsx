'use client';
import Link from 'next/link';
import { useSnap } from '@/components/public/LiveProvider';
import { TeamCrest, fmtTimeAmPm, placeholderName } from '@/components/public/bits';
import { displayStatus, stageLabel } from '@/lib/tournament';

export default function AdminMatches() {
  const snap = useSnap();
  const t = (id: string | null) => snap.teams.find((x) => x.id === id);
  const g = (id: string | null) => snap.groups.find((x) => x.id === id)?.code;
  return (
    <>
      <div className="section-head"><div className="section-title-wrap"><div className="section-kicker">❄️ TAP A MATCH TO OPEN MATCH CONTROL</div><h2 className="section-title"><span className="word-cyan">ALL</span> <span className="word-lime">MATCHES</span></h2><div className="section-underline" /></div></div>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {[...snap.matches].sort((a, b) => a.match_no - b.match_no).map((m) => {
          const st = displayStatus(m);
          return (
            <Link key={m.id} href={`/admin/matches/${m.id}`} className="ws-card" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.6rem', alignItems: 'center', padding: '0.7rem 0.85rem', textDecoration: 'none', color: 'inherit', minHeight: 56 }}>
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>{String(m.match_no).padStart(2, '0')}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', minWidth: 0 }}>
                <TeamCrest team={t(m.home_team_id)} label={m.home_placeholder ?? ''} size={24} />
                <span style={{ fontWeight: 700 }}>{t(m.home_team_id)?.display_name ?? placeholderName(m.home_placeholder)}</span>
                <span style={{ fontFamily: 'var(--font-tall)', fontSize: '1.4rem', color: 'var(--lime)' }}>{m.status === 'scheduled' && m.result_type === 'normal' ? 'vs' : `${m.home_score}–${m.away_score}`}</span>
                <span style={{ fontWeight: 700 }}>{t(m.away_team_id)?.display_name ?? placeholderName(m.away_placeholder)}</span>
                <TeamCrest team={t(m.away_team_id)} label={m.away_placeholder ?? ''} size={24} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: '100%' }}>{stageLabel(m, g(m.group_id))} · {fmtTimeAmPm(m.scheduled_at)}{m.details_incomplete ? ' · ⚠ details incomplete' : ''}</span>
              </span>
              <span className={`status-pill ${st === 'LIVE' ? 'status-live' : st === 'FT' || st === 'FULL TIME' ? 'status-finished' : 'status-upcoming'}`}>{st === 'FULL TIME' ? 'FT (not final)' : st}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
