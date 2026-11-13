'use client';
import { useState } from 'react';
import { useSnap } from '@/components/public/LiveProvider';
import { MatchCard, SectionHead } from '@/components/public/bits';

const FILTERS = [
  { id: 'ALL', label: 'ALL' },
  { id: 'GROUP', label: 'GROUP STAGE' },
  { id: 'A', label: 'GROUP A' },
  { id: 'B', label: 'GROUP B' },
  { id: 'SF', label: 'SEMIFINALS' },
  { id: 'FINAL', label: 'FINAL' },
  { id: 'LIVE', label: '🔴 LIVE' },
  { id: 'DONE', label: '✅ FINISHED' },
];

export default function FixturesPage() {
  const snap = useSnap();
  const [f, setF] = useState('ALL');
  const code = (gid: string | null) => snap.groups.find((g) => g.id === gid)?.code;
  const list = [...snap.matches].sort((a, b) => a.match_no - b.match_no).filter((m) => {
    if (f === 'GROUP') return m.stage === 'group';
    if (f === 'A' || f === 'B') return m.stage === 'group' && code(m.group_id) === f;
    if (f === 'SF') return m.stage === 'semifinal';
    if (f === 'FINAL') return m.stage === 'final' || m.stage === 'third_place';
    if (f === 'LIVE') return m.status === 'live';
    if (f === 'DONE') return m.status === 'full_time' || m.finalized;
    return true;
  });
  return (
    <>
      <SectionHead kicker="❄️ 13 NOV 2026 • OFFSIDE – HOME OF FOOTBALL" cyan="MATCH" lime="FIXTURES">
        <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Group: 10m (+2m max) · SF: 15m (+3m max) · Final: 20m (+4m max) · All times PM (Dhaka)</div>
      </SectionHead>
      <div className="filter-bar no-print">
        {FILTERS.map((x) => (
          <button key={x.id} type="button" className={`filter-btn ${f === x.id ? 'active' : ''}`} onClick={() => setF(x.id)}><span>{x.label}</span></button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="ws-card" style={{ textAlign: 'center', padding: '2.5rem' }}><p style={{ color: 'var(--text-soft)' }}>No matches for this filter.</p></div>
      ) : (
        <div className="grid-2">{list.map((m) => <MatchCard key={m.id} m={m} snap={snap} />)}</div>
      )}
    </>
  );
}
