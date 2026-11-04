# Tribal TV Backend

Repository for Tribal TV backend services and related project code.

## Phase 1 admin dashboard

The Phase 1 React + TypeScript dashboard is a separate frontend application, not an Android app module. The source package is provided as a downloadable ZIP in the project conversation; it has not yet been unpacked into this repository.

The dashboard uses the existing Supabase project `jigzoerxsbumpijksveo` (`eu-west-3`) for Supabase Auth and RLS-protected catalogue reads. Phase 1 remains read-only.

## Supabase/backend scope

The dashboard consumes the existing Supabase database. A single additive migration, `supabase/migrations/20261104125828_add_admin_access_probe_rpc.sql`, adds `public.is_current_user_admin()` as a narrow `SECURITY INVOKER` RPC. It delegates to the existing `private.is_admin()` allow-list function, returns only a boolean, revokes execution from `PUBLIC` and `anon`, and grants execution only to `authenticated`.

No tables, catalogue data, existing RLS policies, existing table grants, Auth settings, or Android code were modified.

## Security requirements

- Keep the existing `public.admin_users` API access restrictions and RLS policies intact.
- Do not select stream URLs/request headers or audit JSON payloads into the browser without a separate security review.
- Never commit a Supabase secret or `service_role` key.
- Only use the Supabase publishable key in browser configuration.
- Do not change the admin-check RPC to `SECURITY DEFINER` or grant it to `anon`/`PUBLIC`.

## Verification status

The admin RPC was tested in SQL using a simulated administrator subject (true), a non-administrator subject (false), and the `anon` database role (execution denied). The React source ZIP is available separately. A full npm build and real browser sign-in still need CI/browser verification.
