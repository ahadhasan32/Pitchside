'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useSnap } from './LiveProvider';
import { displayStatus } from '@/lib/tournament';

export function SnowCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const flakes = Array.from({ length: 55 }, () => ({
      x: Math.random() * width, y: Math.random() * height, r: Math.random() * 2.2 + 0.8,
      speedY: Math.random() * 0.65 + 0.25, speedX: (Math.random() - 0.5) * 0.4, alpha: Math.random() * 0.55 + 0.2,
    }));
    const onResize = () => { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);
    let raf = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const f of flakes) {
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 247, 255, ${f.alpha})`; ctx.fill();
        f.y += f.speedY; f.x += f.speedX;
        if (f.y > height) { f.y = -5; f.x = Math.random() * width; }
        if (f.x > width) f.x = 0; if (f.x < 0) f.x = width;
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return <canvas id="snowCanvas" ref={ref} />;
}

const TABS = [
  { href: '/', label: 'HOME', icon: null },
  { href: '/fixtures', label: '⚽ FIXTURES' },
  { href: '/standings', label: '📊 STANDINGS' },
  { href: '/bracket', label: '🏆 KNOCKOUT' },
  { href: '/stats', label: '🔥 STATS' },
  { href: '/teams', label: '🛡️ TEAMS' },
  { href: '/awards', label: '👑 AWARDS' },
  { href: '/rules', label: '📜 RULEBOOK' },
];

function Ticker() {
  const snap = useSnap();
  const t = (id: string | null) => snap.teams.find((x) => x.id === id)?.display_name ?? 'TBD';
  const items = ['WINTER SHOWDOWN 2026 BY TRIVANTA EVENTS', '13 NOV 2026 • OFFSIDE – HOME OF FOOTBALL, MIRPUR', 'FAIR PLAY • RESPECT THE REFEREE • PLAY TO WIN'];
  const live = snap.matches.filter((m) => m.status === 'live');
  const done = snap.matches.filter((m) => m.status === 'full_time' || m.finalized).sort((a, b) => a.match_no - b.match_no);
  for (const m of live) items.push(`🔴 LIVE [M${String(m.match_no).padStart(2, '0')}]: ${t(m.home_team_id)} ${m.home_score} - ${m.away_score} ${t(m.away_team_id)}`);
  if (done.length) {
    for (const m of done.slice(-6)) {
      const pen = m.pen_home != null && m.pen_away != null && m.stage !== 'group' ? ` (PEN ${m.pen_home}-${m.pen_away})` : '';
      const wo = m.result_type.startsWith('walkover') ? ' (W/O)' : m.result_type === 'abandoned' ? ' (ABANDONED)' : '';
      items.push(`${displayStatus(m) === 'FT' ? 'FT' : 'FULL TIME'} [M${String(m.match_no).padStart(2, '0')}]: ${t(m.home_team_id)} ${m.home_score} - ${m.away_score} ${t(m.away_team_id)}${pen}${wo}`);
    }
  } else items.push('1ST: ৳6,000 + TROPHY • 2ND: ৳4,000 + TROPHY • MAX 10 PLAYERS/TEAM');
  const pass = (k: string) => items.map((txt, i) => (
    <div className="ticker-item" key={k + i} aria-hidden={k === 'b' || undefined}><span className="ticker-flake">❄️</span><span>{txt}</span></div>
  ));
  return (
    <div className="lime-ticker-bar" aria-live="polite">
      <div className="ticker-track">{pass('a')}{pass('b')}</div>
    </div>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const snap = useSnap();
  const anyLive = snap.matches.some((m) => m.status === 'live');
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const banner = snap.settings.banner_en || snap.settings.banner_bn;
  return (
    <>
      <SnowCanvas />
      <div className="app-shell">
        <header className="top-header">
          <div className="header-inner">
            <Link href="/" className="brand-logo">
              <span className="brand-trivanta">TRIVANTA</span>
              <span className="brand-divider">//</span>
              <span className="brand-sub">WINTER SHOWDOWN &apos;26 ❄️</span>
            </Link>
            <div className="header-actions">
              <Link href="/print" className="btn-skew btn-cyan-outline no-print" title="Print standings, schedule & rulebook"><span>🖨️ PRINT VIEW</span></Link>
            </div>
          </div>
          <div className="nav-strip-wrap">
            <nav className="nav-strip" aria-label="Tournament navigation">
              {TABS.map((t) => (
                <Link key={t.href} href={t.href} className={`nav-tab ${isActive(t.href) ? 'active' : ''}`}>
                  {t.href === '/' ? <>{anyLive && <span className="live-dot" />} HOME</> : t.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <Ticker />
        <main className="main-container">
          {banner && (
            <div className="banner-strip">
              {snap.settings.banner_en && <div>📣 {snap.settings.banner_en}</div>}
              {snap.settings.banner_bn && <div lang="bn">📣 {snap.settings.banner_bn}</div>}
            </div>
          )}
          {children}
        </main>
        <footer className="ws-footer">
          <div className="footer-logo">TRIVANTA EVENTS</div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-soft)', maxWidth: 620, margin: '0 auto' }}>
            <strong>WINTER SHOWDOWN 2026</strong> · 13 November 2026 · OFFSIDE – Home of Football (Mirpur) · 6-a-Side Futsal (Max 10 Players/Team)
          </div>
          <div className="footer-follow">❄️ FAIR PLAY • RESPECT THE REFEREE • PLAY TO WIN ❄️</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Points: Win 3 · Draw 1 · Loss 0 | Official Tiebreakers (§13): 1. GD → 2. GF → 3. Head-to-Head → 4. Fair-Play Record → 5. Organiser Decision
          </div>
          <div style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            <a href="https://www.instagram.com/trivanta.play/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }}>Instagram @trivanta.play</a>
          </div>
        </footer>
      </div>
    </>
  );
}
