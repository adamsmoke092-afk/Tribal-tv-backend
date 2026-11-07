# Security notes

## What runs where

| Component | Holds | Can do |
|---|---|---|
| Browser (this app) | project URL + publishable key + the signed-in session | Whatever Row Level Security allows that user |
| Supabase Auth | passwords, sessions | Sign-in only (no sign-up UI) |
| Postgres | `admin_users` allow-list, RLS policies, audit triggers | Final authority on every read and write |

There is **no** service-role key, secret key, TMDB key or provider credential in this
project, and none should ever be added to a `VITE_*` variable.

## Administrator access

1. `supabase.auth.getUser()` validates the session with the Auth server.
2. `public.is_current_user_admin()` is a SECURITY INVOKER wrapper around
   `private.is_admin()`. It takes no arguments, returns only a boolean for the current
   user, and is executable by `authenticated` only.
3. The console treats this as a **UI gate only**. Every catalogue write is independently
   enforced by RLS (`private.is_admin()`), so a tampered browser still cannot write.
4. The browser never reads `admin_users`, and no role is read from browser state or
   editable user metadata. Administrators are added by the database owner via the SQL Editor.

## Things to be aware of

- **Stream URLs and headers are public.** The current policy lets anyone with the
  publishable key read active streams. Do not store credentials in them. Client-side and
  database checks reject common credential-looking parameters (`token`, `key`, `sig`,
  `signature`, `jwt`, `auth`, `password`, …), but this is a guardrail, not a guarantee.
- **The audit log shows full previous/updated values**, which can include stream URLs
  and headers. It is visible to administrators only.
- **Audit identity** is the administrator's user ID (the browser cannot read emails from
  `auth.users`). Changes made by the database owner/service show as "Database owner / service".
- **Reordering is not atomic.** It issues one update per changed row. If one fails the
  page reloads and shows the partially applied order; retry the move.
- **Logo files** are restricted to PNG/JPEG/WebP by the bucket's declared-type check and
  by file-name rules, not by scanning file contents. SVG is not allowed.
- No MFA is enforced for administrators; consider enabling it in Supabase Auth.
- `http://` stream URLs are allowed because the Android app currently permits cleartext
  traffic. Plan to restrict this for a public release.
