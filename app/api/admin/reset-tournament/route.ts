import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';

// Owner-only tournament reset. The password is re-checked on the server before anything changes.
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { data: me } = await sb.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (me?.role !== 'owner') return NextResponse.json({ error: 'Only owners can reset the tournament' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const password = String(body.password ?? '');
  const tournamentId = String(body.tournamentId ?? '');
  if (body.confirm !== 'RESET') return NextResponse.json({ error: 'Type RESET to confirm' }, { status: 400 });
  if (!password) return NextResponse.json({ error: 'Enter your admin password' }, { status: 400 });

  // Re-authenticate with a throwaway client (does not touch the browser session).
  const check = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: authErr } = await check.auth.signInWithPassword({ email: user.email, password });
  if (authErr) return NextResponse.json({ error: 'Wrong password — nothing was changed' }, { status: 401 });
  await check.auth.signOut({ scope: 'local' }).catch(() => undefined); // only this verification session, never the admin's own

  const { data, error } = await sb.rpc('admin_reset_tournament', { p_tournament: tournamentId, p_confirm: 'RESET' });
  if (error) return NextResponse.json({ error: error.message.replace(/^[A-Z_]+: /, '') }, { status: 400 });
  return NextResponse.json({ ok: true, matches: data });
}
