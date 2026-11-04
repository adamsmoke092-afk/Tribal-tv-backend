# Tribal TV Backend

Repository for Tribal TV backend services and related project code.

## Phase 1 admin dashboard

The Phase 1 React + TypeScript dashboard is a separate frontend application, not an Android app module or a backend service. The source package is currently provided as a downloadable ZIP from the project conversation and is not yet unpacked into this repository.

The dashboard uses the existing Supabase project `jigzoerxsbumpijksveo` (`eu-west-3`) for Supabase Auth and RLS-protected catalogue reads. It is read-only in Phase 1.

## Supabase/backend scope

Phase 1 consumes the existing Supabase database as-is. It did not add Edge Functions, migrations, schema changes, grants, RLS changes, or Auth configuration changes. Existing database RLS policies remain the authorization boundary.

## Security requirements

- Keep the existing `public.admin_users` API access restrictions and RLS policies intact.
- Do not select stream URLs/request headers or audit JSON payloads into the browser without a separate security review.
- Never commit a Supabase secret or `service_role` key.
- Only use the Supabase publishable key in browser configuration.
