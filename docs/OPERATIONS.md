# Winter Showdown — operations guide

One repo (this one), one Next.js app on Vercel, one Supabase database. Google Sheets / Apps Script are retired.

## Folder structure

```
app/(public)/…        public site: / fixtures standings bracket stats teams awards rules print matches/[id]
app/admin/…           private admin: dashboard, matches/[id] (match control), knockout, teams, awards,
                      payments, registrations, settings, admins, audit, account
app/api/admin/…       owner-only server routes: CSV export, admin invites (service-role key stays server-side)
app/login, app/auth/callback   sign-in (password or magic link) and email-link handling
components/public|admin        UI (design-v2 look: app/globals.css is design-v2's stylesheet)
lib/tournament.ts     standings, §13 tie-breakers, qualification, knockout winner, player stats, suspensions
lib/awards.ts         award suggestions          lib/data.ts  snapshot loader (public + admin)
supabase/migrations/  versioned SQL: schema, RLS, RPCs, audit triggers, realtime, storage buckets
scripts/              migrate.ts · import-sheet.ts (idempotent xlsx import) · create-owner.ts
tests/                vitest logic tests + db-sim.ts (full simulated tournament, rolled back)
reference/            the old single-file Pitchside app
wintershowdown/       private reference material — git-ignored (public repo!), never deployed
```

## Environment variables (`.env.example`)

| Var | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (all envs) + `.env.local` |
| `NEXT_PUBLIC_SITE_URL` | Production `https://pitchside-beryl.vercel.app`; local `http://localhost:3000`; Preview falls back to `https://$VERCEL_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server only — needed for **Admins → Invite**) + `.env.local` |
| `DATABASE_URL` | `.env.local` only (migrations, importer, db tests) |

## Supabase setup (already done for the live project)

1. `npm run migrate` — applies `supabase/migrations/*.sql` (schema, RLS, RPCs, realtime publication, Storage buckets `logos` (public) and `player-photos` (private) with policies).
2. Authentication → Sign In / Providers: **Allow new users to sign up = OFF**.
3. Authentication → URL Configuration: Site URL `https://pitchside-beryl.vercel.app`; Redirect URLs `https://pitchside-beryl.vercel.app/**`, `http://localhost:3000/**` (add `https://*-<team>.vercel.app/**` for previews if wanted).
4. Realtime: enabled by the migration (`supabase_realtime` publication on matches, match_events, ratings, lineups, teams, players, settings, awards, tournaments).

## First owner

```
npm run create-owner -- bnsq37@gmail.com https://pitchside-beryl.vercel.app
```
Sends a Supabase invite email (or a magic link if the account exists). Open it → you land on **/admin/account** → set your password. No password is ever hardcoded. Further admins: **Admin → Admins → Invite** (owner, scorer, viewer). The last owner cannot be removed.

SQL alternative (user must already exist in Auth → Users):
```sql
insert into admin_users(user_id, email, role) select id, email, 'owner' from auth.users where email = 'bnsq37@gmail.com'
on conflict (user_id) do update set role = 'owner';
```

## Data import (one-time, re-runnable)

```
npm run import:sheet                 # reads wintershowdown/WInter Showdown.xlsx
npm run import:sheet -- --skip-logos # re-run without touching logos
```
Prints the reconciliation report (teams, players, logos, payments total vs sheet, eligibility flags, unmatched, skipped). Re-running never duplicates: teams by Reg ID, players by Reg ID + slot, payments by import key, matches by code. Existing rows edited in admin are kept.

The old Pitchside `tournaments` table does not exist in this Supabase project, so there were no prior results to import (§5B skipped).

## Deploy (Vercel)

The Vercel project `pitchside-beryl` builds this repo. Push to `main` → production deploy.
- Project → Settings → Build: Framework Preset **Next.js** (it was "Other" for the static app). Build `next build`, output default.
- Env vars as above. Redeploy after changing env vars.

## Match-day runbook

1. Admin → Matches → tap the match → **START MATCH** (public shows LIVE instantly).
2. **ADD GOAL** on the scoring team → scorer → assist / No assist → minute (optional) → SAVE. Own goal: tick "Own goal" and pick the conceding player.
3. **CARD** → type → player. Suspended / expelled players are greyed out with a warning.
4. **END MATCH** at full time → check events → **FINALIZE RESULT** (only finalized results count in standings).
5. Knockouts: if level, open **Match details → Penalty shootout**, save, then finalize. The final fills automatically when both semis are finalized.
6. After the 12 group matches: Admin → Standings & KO → **Confirm group standings** → **Generate semifinals**.
7. Awards: Admin → Awards → check suggestion → override if needed → **Publish**.
8. Mistakes: edit/delete any event (before finalizing) or **Reopen**. Everything is in the Audit log.

Two admins can work at once: events are separate rows; match state changes use a version check ("changed by X — reload").

## Backups

Before match day and after the final:
```
pg_dump "$DATABASE_URL" --no-owner --no-privileges -n public -Fc -f ws-$(date +%F-%H%M).dump
```
Restore into an empty project: `pg_restore --no-owner -d "$DATABASE_URL" ws-….dump`. Also: Admin → Settings → CSV exports (teams + players, payments, results). Supabase Pro projects also have daily backups (Database → Backups).

## Cutover checklist

- [x] Schema migrated; importer run and reconciliation report verified (8 teams, 76 players, 8 logos, ৳9,935 collected = sheet).
- [ ] Commit + push to `main`; confirm the production deploy at https://pitchside-beryl.vercel.app (Vercel framework preset → Next.js).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` present in Vercel env (for invites).
- [ ] `npm run create-owner -- bnsq37@gmail.com` → accept invite → set password → invite scorers.
- [ ] Old Pitchside table lock: not applicable (no `tournaments` table in this project). If the old app used a different Supabase project, run there: `alter table tournaments enable row level security; drop policy if exists … ; create policy read_only on tournaments for select using (true);`
- [ ] Apps Script: Extensions → Apps Script → replace `doPost` with
      `function doPost(e){return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Registration is closed'})).setMimeType(ContentService.MimeType.JSON);}`
      → **Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy**. Nothing else in Apps Script is maintained.
- [ ] Netlify: deploy the `netlify-redirect/` folder to the `wintershowdown` site (Deploys → drag & drop). Every path 301s to Vercel.
- [ ] Google Sheet: File → Share → set everyone to Viewer (archive). It is no longer used.

## Custom domain (later)

Vercel → Project → Settings → Domains → add `winter.example.com` → create the CNAME (`cname.vercel-dns.com`) or A record at your DNS host. Then update `NEXT_PUBLIC_SITE_URL`, Supabase Site URL + Redirect URLs, and the Netlify `_redirects` target, and redeploy.

## Next edition

- Create a new `tournaments` row (new slug) + `settings` + `groups`, import or add teams, seed fixtures (see `lib/seed-data.ts` / `roundRobin` in `lib/tournament.ts`), set `NEXT_PUBLIC_TOURNAMENT_SLUG` to the new slug.
- Admin → Settings → Registration open: public submissions go to `registration_submissions` (insert-only, rate-limited, never auto-confirmed).
- Tests: `npm test` (logic) and `npx tsx tests/db-sim.ts` (full DB simulation, rolled back).
