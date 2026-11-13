'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSnap } from './LiveProvider';
import { MatchCard } from './bits';

/** One-row carousel of the full schedule. Opens on the live match, else the next upcoming, else the last played. */
export function FixturesCarousel() {
  const snap = useSnap();
  const track = useRef<HTMLDivElement>(null);
  const positioned = useRef(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const matches = [...snap.matches].filter((m) => m.status !== 'cancelled').sort((a, b) => a.match_no - b.match_no);

  const focusIdx = (() => {
    const live = matches.findIndex((m) => m.status === 'live');
    if (live >= 0) return live;
    const next = matches.findIndex((m) => (m.status === 'scheduled' || m.status === 'postponed') && !m.finalized);
    if (next >= 0) return next;
    for (let i = matches.length - 1; i >= 0; i--) if (matches[i].status === 'full_time' || matches[i].finalized) return i;
    return 0;
  })();

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el || positioned.current || !matches.length) return;
    const card = el.children[focusIdx] as HTMLElement | undefined;
    if (card) { el.style.scrollBehavior = 'auto'; el.scrollLeft = card.offsetLeft - (el.children[0] as HTMLElement).offsetLeft; el.style.scrollBehavior = ''; }
    positioned.current = true;
    update();
  }, [focusIdx, matches.length, update]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [update]);

  const page = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth, behavior: 'smooth' });
  const prev = <button type="button" className="fx-arrow" aria-label="Previous matches" disabled={atStart} onClick={() => page(-1)}>‹</button>;
  const next = <button type="button" className="fx-arrow" aria-label="Next matches" disabled={atEnd} onClick={() => page(1)}>›</button>;

  return (
    <>
      <div className="fx-carousel">
        {prev}
        <div className="fx-track" ref={track} tabIndex={0} role="region" aria-roledescription="carousel" aria-label="Match schedule"
          onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); page(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); page(-1); } }}>
          {matches.map((m) => <div key={m.id}><MatchCard m={m} snap={snap} compact /></div>)}
        </div>
        {next}
      </div>
      <div className="fx-nav-mobile">{prev}{next}</div>
    </>
  );
}
