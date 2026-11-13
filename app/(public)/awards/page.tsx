'use client';
import Link from 'next/link';
import { useSnap } from '@/components/public/LiveProvider';
import { SectionHead } from '@/components/public/bits';
import { FinaleSection, Podium } from '@/components/public/Finale';
import { awardsRevealed } from '@/components/public/Shell';

// Awards are only revealed at the end of the tournament (after the final / when the organisers mark it completed).
export default function AwardsPage() {
  const snap = useSnap();
  if (awardsRevealed(snap)) return <FinaleSection snap={snap} />;
  return (
    <>
      <SectionHead kicker="❄️ GLORY, TROPHIES AND CASH ON THE LINE" cyan="PRIZE" lime="POOL" />
      <div style={{ marginBottom: '1.5rem' }}><Podium snap={snap} /></div>
      <div className="ws-card" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--text-soft)' }}>Champions, runners-up and the individual awards are announced after the Grand Final.</p>
        <Link href="/fixtures" className="btn-skew btn-lime" style={{ marginTop: '0.8rem' }}><span>Follow the matches</span></Link>
      </div>
    </>
  );
}
