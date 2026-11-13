'use client';
import { useSnap } from '@/components/public/LiveProvider';
import { SectionHead } from '@/components/public/bits';
import { AWARD_KEYS, AWARD_META, awardSuggestions, awardWinnerText } from '@/lib/awards';
import { champion } from '@/lib/tournament';

export default function AwardsPage() {
  const snap = useSnap();
  const champ = champion(snap);
  const sug = awardSuggestions(snap);
  return (
    <>
      <SectionHead kicker="❄️ ৳10,000 PRIZE POOL + TROPHIES" cyan="PRIZE" lime="POOL" />
      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        <div className="prize-card-1st">
          <span className="badge-skew" style={{ background: 'var(--lime)', color: '#050B1E', fontSize: '0.82rem' }}>1ST • CHAMPIONS</span>
          <div style={{ fontSize: '3rem', margin: '0.6rem 0 0.2rem' }}>🏆</div>
          <div className="prize-amount">৳6,000</div>
          <div style={{ fontFamily: 'var(--font-sport)', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.12em' }}>+ OFFICIAL CHAMPIONS TROPHY</div>
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,215,0,0.3)', fontSize: '0.9rem', color: '#fff' }}>
            Winner: <strong style={{ color: 'var(--lime)' }}>{champ ? champ.winner.display_name : 'Awaiting Grand Final'}</strong>
          </div>
        </div>
        <div className="prize-card-2nd">
          <span className="badge-skew" style={{ background: 'var(--cyan)', color: '#050B1E', fontSize: '0.82rem' }}>2ND • RUNNERS-UP</span>
          <div style={{ fontSize: '3rem', margin: '0.6rem 0 0.2rem' }}>🥈</div>
          <div className="prize-amount">৳4,000</div>
          <div style={{ fontFamily: 'var(--font-sport)', fontWeight: 700, color: 'var(--cyan)', letterSpacing: '0.12em' }}>+ OFFICIAL RUNNERS-UP TROPHY</div>
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,229,255,0.3)', fontSize: '0.9rem', color: '#fff' }}>
            Runner-up: <strong style={{ color: 'var(--cyan)' }}>{champ?.runnerUp ? champ.runnerUp.display_name : 'Awaiting Grand Final'}</strong>
          </div>
        </div>
      </div>
      <SectionHead kicker="❄️ SPECIAL HONOURS" cyan="INDIVIDUAL" lime="AWARDS" />
      <div className="grid-2">
        {AWARD_KEYS.map((k) => {
          const meta = AWARD_META[k];
          const won = awardWinnerText(snap, snap.awards.find((a) => a.key === k));
          return (
            <div key={k} className="ws-card chamfer lime-bottom">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div>
                  <span className="badge-skew badge-group-a">{meta.subtitle}</span>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', color: 'var(--lime)', margin: '0.4rem 0 0.25rem' }}>{meta.title}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginBottom: '0.85rem' }}>{meta.desc}</p>
                </div>
                <img src={meta.img} alt="" className="award-img" style={{ width: 72, height: 72 }} />
              </div>
              <div style={{ background: 'rgba(5,11,30,0.85)', border: '1px solid rgba(0,229,255,0.35)', padding: '0.7rem 0.85rem', borderRadius: 8 }}>
                <div style={{ fontFamily: 'var(--font-sport)', fontSize: '0.68rem', color: won ? 'var(--gold)' : 'var(--cyan)', letterSpacing: '0.12em' }}>{won ? '🏅 OFFICIAL WINNER' : '⚡ CURRENT LEADER (NOT FINAL)'}</div>
                <div style={{ fontFamily: 'var(--font-sport)', fontSize: '1.02rem', fontWeight: 800, color: '#fff', marginTop: '0.15rem' }}>{won ?? sug[k].text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
