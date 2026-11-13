// Creates the first owner. Sends an invite email (or a magic link if the account exists) — no password is ever set here.
//   npm run create-owner -- bnsq37@gmail.com [https://pitchside-beryl.vercel.app]
import './env';
import { need } from './env';
import { createClient } from '@supabase/supabase-js';
import { inviteAdmin } from '../lib/server/invite';

async function main() {
  const email = process.argv[2];
  if (!email) { console.error('usage: npm run create-owner -- <email> [siteUrl]'); process.exit(1); }
  const site = (process.argv[3] || process.env.OWNER_SITE_URL || 'https://pitchside-beryl.vercel.app').replace(/\/$/, '');
  const svc = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const r = await inviteAdmin(svc, email, 'owner', site);
  console.log(`✓ ${email} is an OWNER (user ${r.userId}). ${r.invited ? 'Invite email sent' : 'Magic link sent'} — open it, then set a password at ${site}/admin/account.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
