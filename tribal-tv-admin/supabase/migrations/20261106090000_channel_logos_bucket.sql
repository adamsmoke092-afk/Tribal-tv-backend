-- =============================================================================
-- Tribal TV - channel logo storage
-- File: supabase/migrations/20261106090000_channel_logos_bucket.sql
--
-- Creates the public "channel-logos" bucket with administrator-only upload,
-- replace and delete. NOT YET APPLIED. Apply with the Supabase CLI workflow
-- (supabase db push) BEFORE deploying the dashboard build that uploads logos.
--
-- Design notes
--  * Public read: the bucket is public, so image URLs of the form
--      <project>/storage/v1/object/public/channel-logos/<file>
--    work for everyone (the Android app) WITHOUT any SELECT policy for anon.
--    No anon/public SELECT policy is created, so the bucket cannot be listed
--    anonymously.
--  * Admin-only writes: INSERT/UPDATE/DELETE (and SELECT, which Storage needs to
--    locate rows for replace/delete) require private.is_admin(), the same
--    allow-list check used by the catalogue tables.
--  * Allowed types: PNG, JPEG, WebP only. No SVG or other types. The Storage
--    API enforces allowed_mime_types against the declared Content-Type, and the
--    policies additionally require a lower-case UUID file name with a .png, .jpg
--    or .webp extension (the dashboard generates exactly this). This is defence
--    in depth, not content inspection: file contents are not scanned.
--  * Size limit: 1 MiB per file.
--  * Unique file names (UUID) mean an updated logo always gets a new URL, so
--    browsers and the app never serve a stale cached image.
-- =============================================================================

begin;

do $guard$
begin
  if exists (select 1 from storage.buckets where id = 'channel-logos') then
    raise exception 'Bucket "channel-logos" already exists; aborting.';
  end if;
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'channel_logos_%'
  ) then
    raise exception 'channel_logos_* policies already exist on storage.objects; aborting.';
  end if;
end
$guard$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'channel-logos',
  'channel-logos',
  true,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp']
);

-- Storage needs SELECT on the rows it replaces or deletes. Admin only.
create policy channel_logos_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'channel-logos' and (select private.is_admin()));

create policy channel_logos_insert_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'channel-logos'
    and (select private.is_admin())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'
  );

create policy channel_logos_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'channel-logos' and (select private.is_admin()))
  with check (
    bucket_id = 'channel-logos'
    and (select private.is_admin())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'
  );

create policy channel_logos_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'channel-logos' and (select private.is_admin()));

-- Self-check: abort and roll back if the result is not what this migration intends.
do $assert$
declare
  b record;
begin
  select * into b from storage.buckets where id = 'channel-logos';
  if b.id is null then
    raise exception 'bucket channel-logos was not created';
  end if;
  if b.public is not true then
    raise exception 'bucket channel-logos must be public (read-only access to images)';
  end if;
  if b.file_size_limit is distinct from 1048576 then
    raise exception 'bucket channel-logos must have a 1 MiB file size limit';
  end if;
  if b.allowed_mime_types is distinct from array['image/png', 'image/jpeg', 'image/webp'] then
    raise exception 'bucket channel-logos must allow only PNG, JPEG and WebP';
  end if;

  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname like 'channel_logos_%') <> 4 then
    raise exception 'expected exactly four channel_logos_* policies on storage.objects';
  end if;

  -- no policy for this bucket may apply to anon or PUBLIC
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'channel_logos_%'
      and (roles && array['anon'::name, 'public'::name])
  ) then
    raise exception 'channel_logos_* policies must be restricted to the authenticated role';
  end if;

  -- every policy must be gated by the admin check
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname like 'channel_logos_%'
      and coalesce(qual, '') || coalesce(with_check, '') not like '%is_admin%'
  ) then
    raise exception 'every channel_logos_* policy must call private.is_admin()';
  end if;
end
$assert$;

commit;

-- =============================================================================
-- AFTER APPLYING (run manually, NOT part of this migration)
--  1. In the dashboard: add a channel and upload a PNG; confirm the logo shows in
--     the list and that its URL opens in a private browser window (public read).
--  2. Confirm a non-admin cannot upload (expect a "refused" message).
--  3. Rerun the Supabase security and performance advisors.
-- If CREATE POLICY on storage.objects fails with "must be owner of table objects",
-- create the same four policies in Dashboard > Storage > Policies using the
-- expressions above.
-- =============================================================================
