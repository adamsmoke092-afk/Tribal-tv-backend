# Tribal TV Admin Dashboard — Phase 1

This separate React + TypeScript + Vite application is delivered as a source ZIP in the project conversation.

## Local setup

Extract the ZIP into a new `admin-dashboard/` directory. Requires Node.js 22.12 or later.

1. Copy `.env.example` to `.env.local`.
2. Set the existing project's Supabase URL and **publishable key**:

```dotenv
VITE_SUPABASE_URL=https://jigzoerxsbumpijksveo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

3. Run `npm install`, then `npm run dev`.
4. Sign in with the existing administrator account. Public sign-up is not provided.

## Authorization

- The browser validates the session with Supabase Auth.
- It calls `public.is_current_user_admin()`, an invoker RPC added by `supabase/migrations/20261104125828_add_admin_access_probe_rpc.sql`.
- The RPC delegates to the existing `private.is_admin()` allow-list function and returns only a boolean.
- `EXECUTE` is granted only to `authenticated`; `PUBLIC` and `anon` are revoked.
- The browser never queries `public.admin_users`; that table remains inaccessible to API roles.
- Existing catalogue RLS policies remain the final authorization boundary.

## Data minimization and constraints

- Stream URLs and request headers are not queried into the browser.
- Audit JSON payloads (`old_data`, `new_data`) are excluded.
- Phase 1 is read-only. There are no catalogue CRUD controls.
- Never place a Supabase secret or `service_role` key in browser code or a `VITE_*` variable.

## Verification

The RPC was tested with simulated admin, non-admin and anonymous database roles. The source syntax was parsed successfully. Full `npm install`, `npm run build`, browser E2E and real administrator sign-in remain pending; see `VERIFICATION.md` in the source ZIP.
