# Tribal TV Admin

A mobile-friendly web console for managing the **built-in IPTV channel catalogue**
stored in Supabase. Sign in with an administrator account and manage:

- **Categories** — add, rename, reorder, activate/deactivate, delete when empty
- **Channels** — name, category, logo (upload or https URL), country, language, EPG ID
  (`tvg-id`), display order, active/inactive, search and filters
- **Streams** — several per channel: HLS / DASH / progressive, priority (0 = primary,
  higher = backups), enable/disable, per-stream User-Agent, Referer and Origin
- **Activity log** — read-only audit trail with previous and updated values
- **Overview** — live totals, catalogue version and last update

It talks to Supabase directly with the **publishable key** and your signed-in
session. Row Level Security in the database is the real enforcement. There is no
server code and no service-role key anywhere in this project.

## Requirements

- Node.js 22.12 or newer
- A Supabase project with the Tribal TV migrations applied (see below)

## Environment variables

Create `.env.local` (never commit it) from `.env.example`:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_…` key |

Never put a service-role key, a `sb_secret_…` key, a TMDB key or any provider
credential in a `VITE_*` variable: everything prefixed `VITE_` is shipped to the browser.

## Run, test, build

```bash
npm install          # commit the generated package-lock.json
npm run dev          # local development
npm test             # unit tests for validation, ordering, audit diff, error messages
npm run typecheck    # strict TypeScript check
npm run build        # production build into dist/
```

## Database prerequisites

Apply the SQL files in `supabase/migrations/` with the Supabase CLI
(`supabase db push`), in timestamp order:

| Migration | Purpose |
|---|---|
| `20261104074641_phase1_iptv_catalogue.sql` | tables, RLS, audit, versioning |
| `20261104125828_add_admin_access_probe_rpc.sql` | `public.is_current_user_admin()` |
| `20261104130240_restrict_admin_access_rpc_execute.sql` | removes `service_role` execute |
| `20261106090000_channel_logos_bucket.sql` | **logo bucket and policies (apply before deploying this version)** |

The first three are already applied to project `jigzoerxsbumpijksveo`. Logo upload
will show "the channel-logos storage bucket does not exist yet" until the fourth is applied.

## Creating an administrator

There is no sign-up screen and nobody can promote themselves.

1. Supabase Dashboard → **Authentication → Users → Add user**: enter email and a strong
   password (tick *Auto Confirm User*).
2. As the **database owner** (Supabase SQL Editor), run:
   ```sql
   insert into public.admin_users (user_id, note)
   select id, 'administrator'
   from auth.users
   where email = 'YOUR_ADMIN_EMAIL';
   ```
3. Sign in to the console. Only accounts in `public.admin_users` get past the check.

## Supabase Auth settings to review (dashboard only)

- **Disable "Allow new users to sign up"** (Authentication → Sign In / Providers).
  The console has no sign-up form, but without this switch anyone could still create a
  non-admin account through the API. Non-admins cannot read or change anything
  sensitive, but there is no reason to allow it.
- Enable **leaked password protection**.
- Add your deployed site URL as the **Site URL** and a **Redirect URL**.

## Using the console

1. **Categories → Add category.** Every channel needs one.
2. **Channels → Add channel.** Fill the details and save; the *Streams* tab then opens.
3. **Add stream.** Priority `0` is the primary; add backups as `1`, `2`, … Use the ↑/↓
   buttons to reorder. Disabled streams are ignored by the app.
4. Prefer **deactivating** a channel or stream over deleting it. Deleting a category is
   only possible when it has no channels.

The Android app picks up changes on its next catalogue refresh (it compares the
catalogue version shown on the Overview page). See `docs/android-catalogue-api.md`.

## Deploying to Vercel

The build output is plain static files, so no server code is involved.

**Before every deploy**, run these on your computer or VPS (not on a metered builder):

```bash
node -v              # must be 22.12 or newer
npm install          # commit the generated package-lock.json
npm test
npm run build
```

A failed hosted build wastes build minutes and leaves the old version live, so only push once all three pass.

**One-time setup (works from a phone browser):**

1. Put this folder in a GitHub repository. If it sits inside a larger repository
   (for example next to the Android project), remember its folder name for step 3.
2. vercel.com → **Add New → Project** → import the repository.
3. Settings on the import screen:
   - Framework Preset: **Vite** (detected from `vercel.json`)
   - Root Directory: the folder containing `package.json` (only if it is not the repo root)
   - Build Command: `npm run build` · Output Directory: `dist`
   - **Environment Variables** (Production, and Preview if you want it): `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Nothing else.
4. Project Settings → Build and Deployment → **Node.js Version: 22.x**, then **Deploy**.
5. Supabase Dashboard → Authentication → URL Configuration: set **Site URL** to your
   Vercel URL and add it under **Redirect URLs**.
6. Open the Vercel URL, sign in, and run through "Using the console" above.

Vite bakes `VITE_` variables into the bundle at **build** time, so after changing them
in Vercel you must redeploy.

**CLI alternative (builds on your own machine, uploads only the result):**

```bash
npm i -g vercel
vercel login
vercel pull --yes --environment=production   # fetches the project's env vars
vercel build --prod
vercel deploy --prebuilt --prod
```

`vercel.json` adds security headers (no-sniff, no framing, no indexing, strict referrer
policy) and a Content-Security-Policy in **report-only** mode. After deploying, open the
browser console on a computer: if no "Content Security Policy" violations appear while you
sign in and use every screen, rename the header in `vercel.json` to
`Content-Security-Policy` to enforce it.

**Plan terms:** check Vercel's current terms for the plan you use. Free "Hobby" plans have
been restricted to personal, non-commercial use; a commercial service may need a paid plan.

The app has no URL routes, so no rewrite rules are needed. You can also deploy the same
build to Cloudflare Pages or GitHub Pages.

## Deploying to GitHub Pages (no custom domain needed)

Your site will be at `https://<your-username>.github.io/<repo-name>/`
(or at the root if the repository is named `<your-username>.github.io`).

1. Create a **new public repository** containing only this dashboard, with
   `package.json` at the repository root. Free GitHub accounts publish Pages from
   public repositories (check GitHub's current rules). Because it is public, keep the
   Android project and the `supabase/` migrations folder in your private repository
   instead. The dashboard source contains no secrets, but there is no reason to publish your schema.
2. Repository **Settings → Pages → Source: GitHub Actions**.
3. Repository **Settings → Secrets and variables → Actions → Variables** tab: add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Use *Variables*, not
   secrets: the publishable key is public by design and ends up in the built site anyway.
4. Push to `main`. `.github/workflows/deploy-pages.yml` installs, runs the tests, builds
   with the correct sub-path (`VITE_BASE_PATH`) and publishes. A failing test or build
   stops the deploy and leaves the previous version live.
5. Supabase → Authentication → URL Configuration: Site URL `https://<your-username>.github.io`,
   and add `https://<your-username>.github.io/<repo-name>/` as a Redirect URL.

Limits of this option:

- GitHub Pages cannot send custom response headers, so the security headers in
  `vercel.json` do not apply (notably the framing protection). Sign-in still protects
  every action, and the database enforces permissions regardless.
- Visitors may see the previous version for a few minutes after a deploy (caching).
- Without the `VITE_BASE_PATH` setting, the page loads blank because its files are
  requested from the wrong path. The workflow sets it for you; set it yourself
  (`VITE_BASE_PATH=/<repo-name>/`) if you ever build by hand for this host.

## Troubleshooting

| Message | Likely cause |
|---|---|
| "…was refused. Your session may have expired, or this account is not an administrator" | Signed out, or the user is not in `admin_users` |
| "the channel-logos storage bucket does not exist yet" | Apply `20261106090000_channel_logos_bucket.sql` |
| "that value already exists" | Duplicate slug, or the same stream URL on the same channel |
| "a category that still has channels" | Move or deactivate its channels first |
| "credential-like parameter" | The URL has `token=`, `key=`, `sig=` … which must not be stored in public stream data |
