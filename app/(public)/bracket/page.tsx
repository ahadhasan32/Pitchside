'use client';
import { useSnap } from '@/components/public/LiveProvider';
import { MatchCard, SectionHead } from '@/components/public/bits';
import { champion } from '@/lib/tournament';
import { BracketUp } from '@/components/public/Finale';

export default function BracketPage() {
  const snap = useSnap();
  const sf1 = snap.matches.find((m) => m.code === 'SF1');
  const third = snap.matches.find((m) => m.code === 'THIRD');
  const champ = champion(snap);
  const set = !!sf1?.home_team_id;
  return (
    <>
      <SectionHead kicker="❄️ ROAD TO THE WINTER CROWN (§14)" cyan="KNOCKOUT" lime="BRACKET" />
      {!set && (
        <div className="ws-card" style={{ marginBottom: '1.25rem', borderLeft: '4px solid var(--cyan)' }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>
            ❄️ <strong>Knockout Rules (§14):</strong> Semifinals (15 mins + up to 3 mins added) and Grand Final (20 mins + up to 4 mins added) have no extra time — ties go straight to a <strong>4-kick penalty shootout</strong> (+ sudden death). Semifinal line-ups appear once the organisers confirm the group standings.
          </div>
        </div>
      )}
      {champ && (
        <div className="champion-banner">
          <div style={{ fontSize: '2.4rem', marginBottom: '0.2rem' }}>🏆❄️👑</div>
          <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.85rem', letterSpacing: '0.24em', color: 'var(--gold)', fontWeight: 800 }}>🏆 WINTER SHOWDOWN CHAMPIONS</div>
          {champ.winner.logo_url && <img src={champ.winner.logo_url} alt="" style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--gold)', margin: '0.5rem auto 0', display: 'block' }} />}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 5.5vw, 3.5rem)', color: 'var(--lime)', margin: '0.3rem 0' }}>{champ.winner.display_name}</div>
          <div style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '0.4rem' }}>
            Final {champ.final.home_score}–{champ.final.away_score}{champ.final.pen_home != null && champ.final.pen_away != null ? ` (${champ.final.pen_home}–${champ.final.pen_away} pens)` : ''} · 🥇 <strong style={{ color: 'var(--gold)' }}>৳6,000 + Trophy</strong>
          </div>
          {champ.runnerUp && <div style={{ fontSize: '0.84rem', color: 'var(--cyan)' }}>🥈 Runners-up: <strong>{champ.runnerUp.display_name}</strong> (৳4,000 + Trophy)</div>}
        </div>
      )}
      <BracketUp snap={snap} />
      {third && snap.settings.third_place_enabled && <div style={{ maxWidth: 680, margin: '1.25rem auto 0' }}><MatchCard m={third} snap={snap} /></div>}
    </>
  );
}
