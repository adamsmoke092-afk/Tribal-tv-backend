# Changes in this release (dashboard v0.2 — catalogue management)

The Phase 1 dashboard was read-only. This release adds the write screens. No new
npm dependencies were added.

## New files
- `src/lib/validation.ts`, `src/lib/ordering.ts`, `src/lib/audit.ts`, `src/lib/errors.ts` — pure, unit-tested logic
- `src/components/Modal.tsx`, `ConfirmDialog.tsx`, `Field.tsx`, `Toasts.tsx`, `StreamsManager.tsx`, `ChannelEditor.tsx`
- `src/pages/CategoriesPage.tsx`, `ChannelsPage.tsx`, `StreamsPage.tsx`, `AuditPage.tsx`
- `src/admin.css` — forms, modals, toasts, mobile layout
- `tests/*.test.ts` — 24 unit tests
- `docs/android-catalogue-api.md` — the contract for the Android app
- `supabase/migrations/20261106090000_channel_logos_bucket.sql` — **not yet applied**
- `supabase/migrations/20261104125828_*.sql`, `20261104130240_*.sql` — repo copies of migrations already applied remotely

## Changed files
- `src/App.tsx` — new pages, toast messages, live catalogue version, real connection status
- `src/lib/data.ts` — all reads plus create/update/delete, reordering, logo upload
- `src/lib/types.ts` — adds `logo_url`, full stream fields, audit payloads, catalogue stats
- `src/lib/adminAccess.ts` — now uses `public.is_current_user_admin()` instead of probing the audit log
- `src/main.tsx` — imports `admin.css`
- `package.json` — adds `npm test`
- `vite.config.ts` — optional `VITE_BASE_PATH` (default `/`), for GitHub Pages sub-path hosting; `index.html` adds a noindex tag
- `.github/workflows/deploy-pages.yml` (new) — tests, build and publish to GitHub Pages
- `vercel.json` (new) — Vite preset, security headers, report-only CSP; `.gitignore` adds `.vercel`
- `README.md`, `SECURITY.md`, `VERIFICATION.md`

## Behaviour changes worth knowing
- The administrator check no longer depends on the audit log having at least one row.
- The Overview page's hard-coded "Verified / Enforced" claims were replaced with real
  values (catalogue version, last update, enabled streams, connection state).
- Admin-only activity now shows previous and updated values (it did not before).
