'use client';
import type { Snapshot } from '@/lib/types';
import { champion } from '@/lib/tournament';
import { AWARD_KEYS, AWARD_META, awardWinnerText } from '@/lib/awards';
import { MatchCard, SectionHead } from './bits';

const CUP: Record<'g' | 's', [string, string, string]> = { g: ['#fff7c2', '#f5c518', '#a8730a'], s: ['#ffffff', '#c5d0e0', '#7d8aa0'] };

/** Trophy from the original site. */
export function Cup({ c, id }: { c: 'g' | 's'; id: string }) {
  const [a, b, d] = CUP[c];
  return (
    <div className="cup">
      <svg viewBox="0 0 140 170" aria-hidden>
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset=".45" stopColor={b} /><stop offset=".6" stopColor={a} /><stop offset="1" stopColor={d} /></linearGradient></defs>
        <g fill={`url(#${id})`}>
          <path d="M32 12H108V52C108 86 90 104 70 104C50 104 32 86 32 52Z" /><path d="M32 24H12C12 60 26 72 44 76L46 66C34 62 26 52 26 36H32Z" />
          <path d="M108 24H128C128 60 114 72 96 76L94 66C106 62 114 52 114 36H108Z" /><rect x="63" y="104" width="14" height="30" />
          <path d="M44 134H96L104 158H36Z" /><rect x="30" y="158" width="80" height="8" rx="2" />
        </g>
        <path d="M70 36l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z" fill="rgba(0,0,0,.22)" />
        <path d="M42 18h12c-4 40-2 62 8 78-14-8-22-26-20-78z" fill="#fff" opacity=".4" />
      </svg>
    </div>
  );
}

/** Champions + runners-up podium (old prize-card look). Before the final it shows the prize pool. */
export function Podium({ snap }: { snap: Snapshot }) {
  const ch = champion(snap);
  const card = (cls: 'p1' | 'p2', rk: string, amt: string, team?: { display_name: string; logo_url: string | null }) => (
    <div className={`pc ${cls}`}>
      <div className="rays" />
      <span className="rk">{rk}</span>
      <Cup c={cls === 'p1' ? 'g' : 's'} id={`cup-${cls}`} />
      {team ? (
        <div className="who">{team.logo_url && <img src={team.logo_url} alt="" />}{team.display_name}</div>
      ) : <b className="amt">{amt}</b>}
      <div style={{ position: 'relative', fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase', color: 'var(--text-soft)', marginTop: 4 }}>{team ? `${amt} + Trophy` : '+ Trophy'}</div>
    </div>
  );
  return (
    <div className="pz">
      {card('p1', ch ? '🏆 Champions' : '1st · Champions', '৳6,000', ch?.winner)}
      {card('p2', ch ? 'Runners-up' : '2nd · Runners-up', '৳4,000', ch?.runnerUp)}
    </div>
  );
}

/** Knockout bracket rising from the semifinals (bottom) to the final and the crown (top), fading in. */
export function BracketUp({ snap }: { snap: Snapshot }) {
  const sf = snap.matches.filter((m) => m.stage === 'semifinal').sort((a, b) => a.match_no - b.match_no);
  const fin = snap.matches.find((m) => m.stage === 'final');
  const ch = champion(snap);
  return (
    <div className="bracket-up">
      <div className="tier semis">{sf.map((m) => <MatchCard key={m.id} m={m} snap={snap} compact />)}</div>
      <div className="connector" />
      {fin && <div className="tier final"><div className="grand-final-card"><MatchCard m={fin} snap={snap} compact /></div></div>}
      <div className="connector" />
      <div className="crown">
        <div style={{ fontSize: '2.4rem' }}>🏆</div>
        <div style={{ fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', color: ch ? 'var(--lime)' : 'var(--text-muted)', fontSize: 'clamp(1.2rem, 3.5vw, 2rem)' }}>{ch ? ch.winner.display_name : 'Champion'}</div>
      </div>
    </div>
  );
}

/** Individual awards in the original look; only published winners are shown as final. */
export function AwardsGrid({ snap }: { snap: Snapshot }) {
  return (
    <div className="aw">
      {AWARD_KEYS.map((k) => {
        const meta = AWARD_META[k];
        const won = awardWinnerText(snap, snap.awards.find((a) => a.key === k));
        return (
          <div key={k} className="ai">
            <img src={meta.img} alt={meta.title} />
            <b>{meta.title.replace(/^THE /, 'The ').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase())}</b>
            <span>{meta.subtitle}</span>
            <div className="winner">{won ?? 'To be announced'}</div>
          </div>
        );
      })}
    </div>
  );
}

export function FinaleSection({ snap }: { snap: Snapshot }) {
  return (
    <>
      <SectionHead kicker="❄️ WINTER SHOWDOWN 2026" cyan="THE" lime="CHAMPIONS" />
      <div style={{ marginBottom: '2rem' }}><Podium snap={snap} /></div>
      <SectionHead kicker="❄️ ROAD TO THE CROWN" cyan="KNOCKOUT" lime="BRACKET" />
      <div style={{ marginBottom: '2rem' }}><BracketUp snap={snap} /></div>
      <SectionHead kicker="❄️ SPECIAL HONOURS" cyan="INDIVIDUAL" lime="AWARDS" />
      <div style={{ marginBottom: '2rem' }}><AwardsGrid snap={snap} /></div>
    </>
  );
}
