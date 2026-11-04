# Tribal TV Admin Dashboard — Phase 1

This separate React + TypeScript + Vite application is delivered in the `Tribal-TV-Admin-Dashboard-Phase1.zip` source archive supplied in this project conversation.

## Local setup

Extract the archive. It creates a `tribal-tv-admin/` project directory.

Requires Node.js 22.12 or later.

1. Copy `.env.example` to `.env.local`.
2. Set the existing project's Supabase publishable key:

```dotenv
VITE_SUPABASE_URL=https://jigzoerxsbumpijksveo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

3. Run `npm install`, then `npm run dev`.
4. Sign in with the already-registered administrator account. Public sign-up is not provided.

## Security and verification

- Never put a Supabase secret or legacy `service_role` key in frontend code or a `VITE_*` variable.
- The browser never queries `public.admin_users`; the existing RLS policy is the authorization boundary.
- Stream URLs, request headers and audit JSON payloads are excluded from dashboard queries.
- Phase 1 is read-only.
- The admin-access probe relies on the existing admin-only audit-log SELECT policy and needs at least one audit row. It fails closed if none exists.
- Supabase schema, grants, RLS policies, migrations and Auth settings were not changed. The Android app was not modified.
- A real npm install, production build and interactive sign-in are still pending verification; the authoring environment could not resolve `registry.npmjs.org`.
