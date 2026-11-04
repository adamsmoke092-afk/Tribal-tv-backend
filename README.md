# Tribal TV Backend

Repository reserved for Tribal TV backend services and related project code.

## Current status

The repository was empty when inspected. An initial README has been committed to establish the project documentation.

## Phase 1 admin dashboard

Phase 1 produced a separate React + TypeScript web application. It is a **frontend**, not a backend service. Its source archive has not yet been committed to this repository.

The dashboard uses the existing Supabase project `jigzoerxsbumpijksveo` in `eu-west-3`, Supabase Auth, and the existing database RLS policies. It does not require a Supabase service-role/secret key.

## Backend scope

Phase 1 did not require new Supabase Edge Functions, database migrations, schema changes, grants, or RLS policy changes. The existing Supabase database is the backend.

## Security requirements

- Never commit a Supabase secret key or `service_role` key.
- Never put privileged keys in a `VITE_*` variable.
- Keep the existing `public.admin_users` access restrictions and RLS policies intact.
- Stream URLs and request headers may contain credentials; avoid exposing them to browser clients.

## Verification status

The existing Supabase configuration and authorization policies were inspected. Admin and non-admin RLS behaviour was tested with simulated JWT subjects. A full local npm install and production build remain unverified because the authoring environment could not reach the npm registry.

The Phase 1 dashboard is read-only and has not modified the Android application.
