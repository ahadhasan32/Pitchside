import type { SupabaseClient } from '@supabase/supabase-js';

/** Invite (or re-use) an auth user and grant an admin role. Uses the service-role client. */
export async function inviteAdmin(svc: SupabaseClient, email: string, role: 'owner' | 'scorer' | 'viewer', site: string) {
  const redirectTo = `${site}/auth/callback?next=/admin/account`;
  let userId: string | null = null;
  let invited = false;
  const inv = await svc.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!inv.error && inv.data.user) { userId = inv.data.user.id; invited = true; }
  else {
    // Already registered: find the user, and send a magic link instead.
    for (let page = 1; page < 50 && !userId; page++) {
      const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
      if (data.users.length < 200) break;
    }
    if (!userId) throw inv.error ?? new Error('Could not invite user');
    await svc.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
  }
  const { error } = await svc.from('admin_users').upsert({ user_id: userId, email: email.toLowerCase(), role }, { onConflict: 'user_id' });
  if (error) throw error;
  return { userId, invited };
}
