# Tribal TV Backend

This repository hosts backend-related code for Tribal TV. The Phase 1 administrator web application is kept separately under `admin-dashboard/` so it does not get mixed into the Android app.

## Phase 1: Admin dashboard

The `admin-dashboard/tribal-tv-admin-phase1.zip` archive contains the React + TypeScript dashboard source project.

It connects directly to the existing Supabase project `jigzoerxsbumpijksveo` in `eu-west-3`. It uses Supabase Auth and the existing database RLS policies. It does not require or contain a Supabase service-role/secret key.

### Local setup

1. Download and extract `admin-dashboard/tribal-tv-admin-phase1.zip`.
2. Open the extracted `tribal-tv-admin` directory.
3. Copy `.env.example` to `.env.local`.
4. Set `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's publishable key.
5. Run `npm install`, then `npm run dev`.

Requires Node.js 22.12 or later.

## Security boundary

- Do not add Supabase secret or `service_role` keys to this repository or any `VITE_*` variable.
- The dashboard does not query `public.admin_users`; it uses the existing admin-only RLS boundary.
- Existing Supabase schema, grants, migrations and RLS policies were left unchanged during Phase 1.
- This Phase 1 dashboard is read-only.

## Verification

The Supabase infrastructure and RLS access path were inspected. A local dependency install and full Vite production build could not be run in the authoring environment because npm registry access was unavailable. See `admin-dashboard/VERIFICATION.md` in the source archive for the verification details.

**Note:** The dashboard is a separate web frontend. No new Supabase Edge Functions or database migrations are part of Phase 1.
