'use client';
import { useSnap } from '@/components/public/LiveProvider';
import { MatchCard, SectionHead } from '@/components/public/bits';
import { champion } from '@/lib/tournament';

export default function BracketPage() {
  const snap = useSnap();
  const sf1 = snap.matches.find((m) => m.code === 'SF1');
  const sf2 = snap.matches.find((m) => m.code === 'SF2');
  const fin = snap.matches.find((m) => m.code === 'FINAL');
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
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--cyan)', marginBottom: '0.65rem' }}>
          ⚡ STAGE 1: SEMIFINALS (15 MIN + UP TO 3 MIN ADDED · 4-KICK PENALTY SHOOTOUT IF TIED)
        </div>
        <div className="bracket-stage-grid">
          {sf1 && <div><MatchCard m={sf1} snap={snap} /></div>}
          {sf2 && <div><MatchCard m={sf2} snap={snap} /></div>}
        </div>
      </div>
      <div style={{ textAlign: 'center', margin: '0.5rem 0 1rem', color: 'var(--lime)', fontFamily: 'var(--font-sport)', fontWeight: 800, letterSpacing: '0.2em' }}>▼ SEMIFINAL WINNERS ADVANCE TO THE GRAND FINAL ▼</div>
      {fin && (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="grand-final-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span className="badge-skew badge-ko" style={{ fontSize: '0.85rem', padding: '0.25rem 0.8rem' }}>🏆 GRAND FINAL • 20 MIN + UP TO 4 MIN ADDED</span>
              <span style={{ fontFamily: 'var(--font-sport)', fontSize: '0.78rem', color: 'var(--lime)' }}>1ST: ৳6,000 · 2ND: ৳4,000</span>
            </div>
            <MatchCard m={fin} snap={snap} />
          </div>
        </div>
      )}
      {third && snap.settings.third_place_enabled && <div style={{ maxWidth: 680, margin: '1.25rem auto 0' }}><MatchCard m={third} snap={snap} /></div>}
    </>
  );
}
