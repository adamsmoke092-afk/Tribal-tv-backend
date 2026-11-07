# Verification record

Honest account of what was actually run, and what was not. Nothing below is claimed
beyond what the "How" column says.

## Checks that ran (in the build sandbox, no network)

| Check | Result | How |
|---|---|---|
| Unit tests — validation, ordering, audit diff, error translation | **24 / 24 pass** | `npm test` (Node built-in runner). Validation cases mirror the database rules |
| Strict TypeScript check (TS 6.0.3, the flags in `tsconfig.app.json`, incl. unused locals/params) | **pass** | Compiled against **stub** type declarations for React, Supabase and lucide-react, because those packages could not be installed offline. The checker was shown to fail when an error was injected |
| Bundle resolution of every relative import and all JSX | **pass** | esbuild with react, lucide-react and supabase-js marked external |
| Secrets scan of `src/`, `index.html`, `.env.example` | **clean** | grep for service-role/secret keys, JWTs, TMDB, provider names. `admin_users` is only used as an audit filter label, never queried |

## Database behaviour verified earlier (Phase 1, live project, rolled-back transaction)

Run as roles `anon`, `authenticated` (non-admin and a simulated admin) and `service_role`.
Nothing persisted (confirmed by a follow-up count).

- Non-admins and anon could not write the catalogue; nobody could read or write `admin_users`
  through the API; admins could read but not modify the audit log.
- Inactive categories/channels/streams were hidden from anon; a non-admin saw 0 audit rows.
- Inserts with `token=`/`sig=` parameters, `user:pass@`, control characters in User-Agent,
  an Origin with a path, the `rtmp` type, duplicates and `http://` logos were rejected;
  a plain `http://` stream and a backup stream with different headers were accepted.
- Catalogue version rose 1 → 9 across 8 write statements; audit rows recorded the actor
  and, for an update, old and new values.

## NOT run — do these before relying on it

| Not run | Why | Do this |
|---|---|---|
| `npm run build` with the real dependencies | No npm access in the sandbox | Run `npm install && npm test && npm run build` locally or on a VPS. **A failed hosted build costs credits** |
| Any browser/UI test (sign-in, forms, modals, reordering, mobile layout) | No browser or network | Click through the "Using the console" steps on a phone and a computer |
| Calling `is_current_user_admin()` from the app as admin and non-admin | Not executed | Sign in as an admin, then as a normal user, and confirm access is denied |
| Logo upload | The storage migration is **written but not applied** | Apply it with the CLI, then follow the checklist in the migration file |
| Header values read back after saving | Only insert/reject behaviour was tested | Add a stream with all three headers, reopen it, confirm they persist |
| Real-React type correctness | Stubbed types | The real build above is the proof |
| Android integration | Android code not available | See `docs/android-catalogue-api.md` |

## Mapping to the requested test list

| # | Requested test | Status |
|---|---|---|
| 1 | Unauthenticated users cannot access the dashboard | Code path reviewed (sign-in screen unless verified admin); **UI not run**. Database-level: anon cannot write (verified) |
| 2 | Non-admin users are denied | Database denial **verified**; the UI path and the RPC call **not run** |
| 3 | Administrators can add categories | Database level **verified** (simulated admin); UI **not run** |
| 4 | Administrators can add channels | Channel insert verified as `service_role`; admin policy identical but **channel insert as admin not run**; UI **not run** |
| 5 | Multiple streams | Primary + backup + http stream inserts **verified** at database level; UI **not run** |
| 6 | Stream headers saved correctly | Inserts with headers accepted and invalid ones rejected; **read-back not verified** |
| 7 | Logo uploads | **Not run** (migration not applied) |
| 8 | Inactive hidden from ordinary reads | **Verified** (database) |
| 9 | Audit entries after changes | **Verified** (database) |
| 10 | Catalogue version changes | **Verified** (database) |
| 11 | No service-role/third-party secret in the browser | Source scan **clean**; the built bundle was **not** inspected |
