'use client';
import { useMemo } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { SectionHead } from '@/components/public/bits';
import { FullStandings } from '@/components/public/Standings';
import { computeGroupTable } from '@/lib/tournament';

export default function StandingsPage() {
  const snap = useSnap();
  const groups = useMemo(() => snap.groups.map((g) => computeGroupTable(snap, g.id)), [snap]);
  return (
    <>
      <SectionHead kicker="❄️ OFFICIAL RULEBOOK §13 STANDINGS" cyan="TOURNAMENT" lime="STANDINGS">
        <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>
          Tiebreakers (§13): <strong>1. GD → 2. GF → 3. Head-to-Head → 4. Fair-Play (FP) → 5. Organiser Decision</strong>
        </div>
      </SectionHead>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {groups.map((g) => <FullStandings key={g.groupId} g={g} snap={snap} />)}
      </div>
    </>
  );
}
