'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdmin, type Role } from './AdminContext';
import { SignOut } from './SignOut';

const LINKS: { href: string; label: string; min: Role }[] = [
  { href: '/admin', label: '⚡ DASHBOARD', min: 'viewer' },
  { href: '/admin/matches', label: '⚽ MATCHES', min: 'viewer' },
  { href: '/admin/knockout', label: '🏆 STANDINGS & KO', min: 'viewer' },
  { href: '/admin/teams', label: '🛡️ TEAMS & ROSTERS', min: 'viewer' },
  { href: '/admin/ratings', label: '⭐ RATINGS', min: 'viewer' },
  { href: '/admin/awards', label: '👑 AWARDS', min: 'viewer' },
  { href: '/admin/payments', label: '💳 PAYMENTS', min: 'viewer' },
  { href: '/admin/registrations', label: '🗂️ REGISTRATIONS', min: 'viewer' },
  { href: '/admin/settings', label: '⚙️ SETTINGS', min: 'owner' },
  { href: '/admin/admins', label: '👤 ADMINS', min: 'owner' },
  { href: '/admin/audit', label: '📜 AUDIT LOG', min: 'viewer' },
];

export function AdminNav() {
  const path = usePathname();
  const { email, role, can } = useAdmin();
  const active = (h: string) => (h === '/admin' ? path === '/admin' : path.startsWith(h));
  return (
    <header className="top-header">
      <div className="header-inner">
        <Link href="/admin" className="brand-logo">
          <span className="brand-trivanta">ADMIN</span><span className="brand-divider">//</span><span className="brand-sub">WINTER SHOWDOWN &apos;26</span>
        </Link>
        <div className="header-actions" style={{ gap: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} className="no-print">{email} · <strong style={{ color: 'var(--lime)' }}>{role.toUpperCase()}</strong></span>
          <Link href="/" className="btn-skew btn-cyan-outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }} target="_blank"><span>PUBLIC SITE ↗</span></Link>
          <Link href="/admin/account" className="btn-skew btn-cyan-outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}><span>ACCOUNT</span></Link>
          <SignOut />
        </div>
      </div>
      <div className="nav-strip-wrap">
        <nav className="nav-strip">
          {LINKS.filter((l) => can(l.min)).filter((l) => role !== 'scorer' || ['/admin', '/admin/matches', '/admin/knockout', '/admin/awards', '/admin/teams', '/admin/ratings'].includes(l.href)).map((l) => (
            <Link key={l.href} href={l.href} className={`nav-tab ${active(l.href) ? 'active' : ''}`}>{l.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
