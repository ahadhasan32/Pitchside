import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { loadSnapshot } from '@/lib/data';
import { LiveProvider } from '@/components/public/LiveProvider';
import { AdminProvider, type Role } from '@/components/admin/AdminContext';
import { ConfirmHost } from '@/components/admin/Confirm';
import { AdminNav } from '@/components/admin/AdminNav';
import { SignOut } from '@/components/admin/SignOut';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Winter Showdown 2026', robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await sb.from('admin_users').select('role, email').eq('user_id', user.id).maybeSingle();
  if (!me) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem', textAlign: 'center' }}>
        <div className="ws-card" style={{ maxWidth: 440 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--lime)' }}>NO ADMIN ACCESS</h2>
          <p style={{ color: 'var(--text-soft)', margin: '0.6rem 0 1rem' }}>{user.email} is signed in but has not been given an admin role. Ask an owner to invite you.</p>
          <SignOut />
        </div>
      </div>
    );
  }
  const snap = await loadSnapshot(sb);
  return (
    <AdminProvider role={me.role as Role} email={me.email} userId={user.id}>
      <LiveProvider initial={snap} pollMs={15000}>
        <div className="app-shell">
          <AdminNav />
          <main className="main-container" style={{ paddingTop: '1rem' }}>{children}</main>
        </div>
        <ConfirmHost />
      </LiveProvider>
    </AdminProvider>
  );
}
