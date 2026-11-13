import { LiveProvider } from '@/components/public/LiveProvider';
import { PublicShell } from '@/components/public/Shell';
import { loadSnapshot } from '@/lib/data';
import { supabaseAnon } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const snap = await loadSnapshot(supabaseAnon());
  return (
    <LiveProvider initial={snap}>
      <PublicShell>{children}</PublicShell>
    </LiveProvider>
  );
}
