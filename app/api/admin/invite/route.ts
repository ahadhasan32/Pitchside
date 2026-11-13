import { NextResponse, type NextRequest } from 'next/server';
import { siteUrl, supabaseServer, supabaseService } from '@/lib/supabase/server';
import { inviteAdmin } from '@/lib/server/invite';

// Owner invites a new admin. The service-role key stays on the server.
export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: me } = await sb.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
  if (me?.role !== 'owner') return NextResponse.json({ error: 'Only owners can invite admins' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = ['owner', 'scorer', 'viewer'].includes(body.role) ? body.role : 'scorer';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  try {
    const r = await inviteAdmin(supabaseService(), email, role, siteUrl());
    return NextResponse.json({ ok: true, invited: r.invited });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
