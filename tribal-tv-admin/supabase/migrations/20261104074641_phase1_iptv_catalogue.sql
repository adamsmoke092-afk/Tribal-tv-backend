-- =============================================================================
-- Tribal TV - Phase 1 (revision 2): central built-in IPTV catalogue
-- File: supabase/migrations/20261104074641_phase1_iptv_catalogue.sql
--
-- Scope: catalogue tables, per-stream HTTP headers, admin allow-list, audit
-- log, catalogue versioning.
-- NOT in scope: personal M3U playlists (stay on-device), EPG programme
-- storage, movie/TV API functions, scheduled jobs, Android changes.
--
-- WORKFLOW: apply ONLY through the version-controlled Supabase migration
-- workflow (supabase db push) so remote migration history and Git stay in
-- sync. Do not run this file through the SQL Editor or an MCP tool.
--
-- -----------------------------------------------------------------------------
-- SECURITY NOTES (read before approving)
--
-- 1. STREAM URLS ARE PUBLIC. Active channel_streams rows, including stream_url
--    and the user_agent / referer / origin headers, are readable through the
--    Data API by ANYONE who holds the project's publishable (anon) key, which
--    ships inside the Android app. RLS here controls which rows are listed
--    (active only); it does NOT protect stream URLs. Any URL an app plays can
--    also be captured from network traffic. Do not store secrets in stream
--    URLs or in the header columns.
--
-- 2. ANON READ IS INTENTIONAL FOR NOW. Tribal TV has no Supabase
--    authentication yet, so channel_streams (and the other catalogue tables)
--    are readable by anon and authenticated. Moving to authenticated-only
--    requires Android changes (anonymous or real sign-in, secure token
--    storage and refresh, offline handling) and would still not hide URLs.
--
-- 3. CLEARTEXT HTTP IS ALLOWED. stream_url accepts http:// and https:// because
--    the Android app currently sets usesCleartextTraffic="true" and the
--    authorised sources have not been audited for HTTPS. Plain http can be
--    read or modified by anyone on the network path. For a public release,
--    prefer https and replace the blanket manifest flag with domain-specific
--    cleartext exceptions in a network security config.
--
-- 4. NO CREDENTIAL COLUMNS. There are deliberately no Authorization, Cookie,
--    password or provider API-key columns. Check constraints also reject
--    userinfo (user:pass@) and a list of common secret-looking query
--    parameter NAMES (token, jwt, signature, sig, auth, refresh_token,
--    credential(s), api_key, password, ...) in stream_url and referer.
--    These are GUARDRAILS, NOT A GUARANTEE: they only match those exact
--    parameter names in the query string. They do not detect secrets in path
--    segments, fragments, URL-encoded names, unlisted names or opaque values.
--    Side effect: legitimate signed/tokenised stream URLs will also be
--    rejected. Stream URLs are publicly readable (note 1), so never store
--    anything that must stay secret.
--
-- 5. SERVICE ROLE IS NARROWED. service_role bypasses RLS, so table privileges
--    are its only guard, and this project's default ACLs grant it ALL on new
--    public tables. Section 7 therefore resets it to least privilege:
--      - no privilege at all on admin_users, admin_audit_log or the audit
--        identity sequence;
--      - exactly SELECT, INSERT, UPDATE, DELETE on channel_categories,
--        channels and channel_streams (no TRUNCATE, REFERENCES, TRIGGER or
--        MAINTAIN), for future trusted Edge Functions;
--      - exactly SELECT on catalogue_meta.
--    admin_users is managed by the DATABASE
--    OWNER through the SQL Editor, not through service_role. The database
--    owner (postgres) remains a trusted authority and can still change any
--    data, including audit records. SECURITY DEFINER trigger functions run
--    with their owner's privileges and do not depend on service_role.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Preconditions: fail fast instead of silently merging into existing objects
--    or touching an existing "private" schema.
-- -----------------------------------------------------------------------------
do $guard$
begin
  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'channel_categories', 'channels', 'channel_streams',
        'catalogue_meta', 'admin_users', 'admin_audit_log'
      )
  ) then
    raise exception 'Phase 1 catalogue objects already exist in schema public; aborting.';
  end if;

  if exists (select 1 from pg_catalog.pg_namespace where nspname = 'private') then
    raise exception 'Schema "private" already exists; refusing to modify its privileges. Review it first.';
  end if;
end
$guard$;

-- -----------------------------------------------------------------------------
-- 1. Private schema for helper/trigger functions.
--    Not listed in the Data API exposed schemas, so nothing here is callable
--    through /rest/v1/rpc. It contains functions only, no tables.
-- -----------------------------------------------------------------------------
create schema private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;   -- required so RLS policies can call private.is_admin()

-- Generic updated_at trigger function (SECURITY INVOKER, touches no tables).
create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$fn$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

-- 2.1 channel_categories ------------------------------------------------------
create table public.channel_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null,
  name        text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint channel_categories_slug_key    unique (slug),
  constraint channel_categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  constraint channel_categories_name_len    check (length(btrim(name)) between 1 and 100)
);
comment on table public.channel_categories is 'Built-in IPTV channel categories, managed centrally by administrators.';

-- 2.2 channels ----------------------------------------------------------------
create table public.channels (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null,
  name         text not null,
  category_id  uuid not null references public.channel_categories (id) on delete restrict,
  logo_url     text,
  country      text,   -- ISO 3166-1 alpha-2, upper case
  language     text,   -- ISO 639 code, lower case
  epg_id       text,   -- identifier only; EPG programme storage is a later phase
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint channels_slug_key    unique (slug),
  constraint channels_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 96),
  constraint channels_name_len    check (length(btrim(name)) between 1 and 150),
  constraint channels_logo_url_format check (
    logo_url is null or (logo_url ~* '^https://[^[:space:]]+$' and length(logo_url) <= 2048)
  ),
  constraint channels_country_format  check (country  is null or country  ~ '^[A-Z]{2}$'),
  constraint channels_language_format check (language is null or language ~ '^[a-z]{2,3}$'),
  constraint channels_epg_id_format   check (
    epg_id is null or (length(epg_id) between 1 and 200 and epg_id !~ '[[:space:]]')
  )
);
create index channels_category_sort_idx on public.channels (category_id, sort_order);
comment on table public.channels is 'Built-in IPTV channels. Separate from personal M3U playlists, which stay on the device.';

-- 2.3 channel_streams ---------------------------------------------------------
create table public.channel_streams (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references public.channels (id) on delete cascade,
  stream_url   text not null,
  stream_type  text not null default 'hls',
  priority     integer not null default 0,   -- lower = tried first; higher values are backups
  user_agent   text,                          -- optional per-stream HTTP User-Agent
  referer      text,                          -- optional per-stream HTTP Referer
  origin       text,                          -- optional per-stream HTTP Origin (scheme://host[:port])
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint channel_streams_channel_url_key unique (channel_id, stream_url),
  constraint channel_streams_type_check      check (stream_type in ('hls', 'dash', 'progressive')),
  constraint channel_streams_priority_check  check (priority >= 0),
  -- http AND https are accepted on purpose (see security note 3).
  constraint channel_streams_url_format      check (
    length(stream_url) <= 2048 and stream_url ~* '^https?://[^[:space:]]+$'
  ),
  constraint channel_streams_url_no_userinfo check (stream_url !~* '^https?://[^/?#]*@'),
  -- GUARDRAIL ONLY (see security note 4): matches these exact query-parameter
  -- names, case-insensitively. Not a guarantee that every secret is detected.
  constraint channel_streams_url_no_secrets  check (
    stream_url !~* '[?&;](api[_-]?key|secret|client[_-]?secret|password|passwd|access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|token|jwt|signature|sig|auth|credentials?)='
  ),
  -- Per-stream request headers. No control characters (prevents header injection).
  constraint channel_streams_user_agent_check check (
    user_agent is null
    or (length(btrim(user_agent)) between 1 and 512 and user_agent !~ '[[:cntrl:]]')
  ),
  constraint channel_streams_referer_check check (
    referer is null
    or (
      length(referer) <= 2048
      and referer ~* '^https?://[^[:space:]]+$'
      and referer !~* '^https?://[^/?#]*@'
      and referer !~* '[?&;](api[_-]?key|secret|client[_-]?secret|password|passwd|access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|token|jwt|signature|sig|auth|credentials?)='
    )
  ),
  constraint channel_streams_origin_check check (
    origin is null
    or (length(origin) <= 255 and origin ~* '^https?://[^/?#@[:space:]]+$')
  )
);
create index channel_streams_channel_priority_idx on public.channel_streams (channel_id, priority);
comment on table public.channel_streams is
  'Authorised stream sources per channel (primary + backups). WARNING: active rows, including headers, are publicly readable via the Data API with the anon key; this does not protect stream URLs.';
comment on column public.channel_streams.user_agent is 'Optional per-stream User-Agent header. Publicly readable. Not a secret.';
comment on column public.channel_streams.referer    is 'Optional per-stream Referer header. Publicly readable. Not a secret.';
comment on column public.channel_streams.origin     is 'Optional per-stream Origin header (scheme://host[:port], no path). Publicly readable. Not a secret.';

-- 2.4 catalogue_meta (single row) ----------------------------------------------
create table public.catalogue_meta (
  id          smallint primary key default 1,
  version     bigint not null default 1,
  updated_at  timestamptz not null default now(),
  constraint catalogue_meta_single_row check (id = 1),
  constraint catalogue_meta_version_positive check (version >= 1)
);
insert into public.catalogue_meta (id) values (1);
comment on table public.catalogue_meta is 'Single-row catalogue version. Bumped once per write statement touching categories, channels or streams.';

-- 2.5 admin_users -------------------------------------------------------------
create table public.admin_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now(),
  constraint admin_users_note_len check (note is null or length(note) <= 200)
);
comment on table public.admin_users is 'Explicit allow-list of catalogue administrators. Managed by the database owner through the SQL Editor, not through service_role. No API role (anon, authenticated, service_role) has any privilege on it.';

-- 2.6 admin_audit_log ---------------------------------------------------------
create table public.admin_audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,         -- auth.uid(); null when changed via SQL editor/service role. Not an FK so history survives user deletion.
  actor_role   text,         -- JWT role, or the database session user when there is no JWT
  table_name   text not null,
  record_id    uuid not null,
  action       text not null,
  old_data     jsonb,
  new_data     jsonb,
  constraint admin_audit_log_action_check check (action in ('INSERT', 'UPDATE', 'DELETE'))
);
create index admin_audit_log_occurred_idx on public.admin_audit_log (occurred_at desc);
create index admin_audit_log_record_idx   on public.admin_audit_log (table_name, record_id);
comment on table public.admin_audit_log is 'Record of changes to categories, channels, streams and admin_users. Readable by administrators only; written only by trigger.';

-- -----------------------------------------------------------------------------
-- 3. Administrator check
--    SECURITY DEFINER so it can read admin_users, which clients cannot. It is
--    owned by the migration role, which also owns admin_users and therefore
--    bypasses RLS on it (FORCE RLS is NOT enabled; asserted at the end).
--    search_path is empty, all references are qualified, execute is limited
--    to the authenticated role.
-- -----------------------------------------------------------------------------
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = (select auth.uid())
  );
$fn$;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Catalogue versioning (statement-level: a bulk import bumps once)
-- -----------------------------------------------------------------------------
create function private.bump_catalogue_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  update public.catalogue_meta
     set version    = version + 1,
         updated_at = pg_catalog.now()
   where id = 1;
  return null;
end;
$fn$;
revoke all on function private.bump_catalogue_version() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Audit trigger function (row-level; skips no-op updates).
--    Handles tables keyed by "id" and admin_users (keyed by "user_id").
-- -----------------------------------------------------------------------------
create function private.log_catalogue_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_id   uuid;
  v_old  pg_catalog.jsonb;
  v_new  pg_catalog.jsonb;
  v_row  pg_catalog.jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := pg_catalog.to_jsonb(new);
    v_row := v_new;
  elsif tg_op = 'UPDATE' then
    v_old := pg_catalog.to_jsonb(old);
    v_new := pg_catalog.to_jsonb(new);
    v_row := v_new;
    if (v_old - 'updated_at') = (v_new - 'updated_at') then
      return null;   -- nothing meaningful changed
    end if;
  else
    v_old := pg_catalog.to_jsonb(old);
    v_row := v_old;
  end if;

  v_id := (coalesce(v_row ->> 'id', v_row ->> 'user_id'))::uuid;

  insert into public.admin_audit_log
    (actor_id, actor_role, table_name, record_id, action, old_data, new_data)
  values
    (auth.uid(),
     coalesce(auth.jwt() ->> 'role', session_user::pg_catalog.text),
     tg_table_name, v_id, tg_op, v_old, v_new);

  return null;
end;
$fn$;
revoke all on function private.log_catalogue_change() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Triggers
-- -----------------------------------------------------------------------------
create trigger channel_categories_set_updated_at before update on public.channel_categories
  for each row execute function private.set_updated_at();
create trigger channels_set_updated_at before update on public.channels
  for each row execute function private.set_updated_at();
create trigger channel_streams_set_updated_at before update on public.channel_streams
  for each row execute function private.set_updated_at();

create trigger channel_categories_audit after insert or update or delete on public.channel_categories
  for each row execute function private.log_catalogue_change();
create trigger channels_audit after insert or update or delete on public.channels
  for each row execute function private.log_catalogue_change();
create trigger channel_streams_audit after insert or update or delete on public.channel_streams
  for each row execute function private.log_catalogue_change();
create trigger admin_users_audit after insert or update or delete on public.admin_users
  for each row execute function private.log_catalogue_change();

-- admin_users changes are audited but intentionally do NOT bump the catalogue version.
create trigger channel_categories_bump_version after insert or update or delete or truncate on public.channel_categories
  for each statement execute function private.bump_catalogue_version();
create trigger channels_bump_version after insert or update or delete or truncate on public.channels
  for each statement execute function private.bump_catalogue_version();
create trigger channel_streams_bump_version after insert or update or delete or truncate on public.channel_streams
  for each statement execute function private.bump_catalogue_version();

-- -----------------------------------------------------------------------------
-- 7. Privileges (explicit; this project's default ACLs grant new public tables
--    to anon/authenticated/service_role, so we revoke first)
-- -----------------------------------------------------------------------------
revoke all on table
  public.channel_categories, public.channels, public.channel_streams,
  public.catalogue_meta, public.admin_users, public.admin_audit_log
  from public, anon, authenticated;

grant select on public.channel_categories, public.channels, public.channel_streams, public.catalogue_meta to anon;
grant select, insert, update, delete on public.channel_categories, public.channels, public.channel_streams to authenticated;
grant select on public.catalogue_meta  to authenticated;
grant select on public.admin_audit_log to authenticated;   -- further limited to admins by RLS
-- admin_users: no grants to anon/authenticated at all.

-- service_role has BYPASSRLS, so RLS never restricts it; table privileges are its
-- only guard. Default ACLs grant it ALL on new public tables and sequences, so
-- narrow that explicitly. Trigger functions are unaffected: they run as the
-- table owner (SECURITY DEFINER), not as service_role.
revoke all on table public.admin_users     from service_role;
revoke all on table public.admin_audit_log from service_role;

do $seq$
declare
  v_seq text := pg_catalog.pg_get_serial_sequence('public.admin_audit_log', 'id');
begin
  if v_seq is null then
    raise exception 'identity sequence for public.admin_audit_log.id not found';
  end if;
  execute pg_catalog.format(
    'revoke all on sequence %s from public, anon, authenticated, service_role', v_seq);
end
$seq$;

-- Catalogue records: reset to exactly SELECT/INSERT/UPDATE/DELETE for future
-- trusted Edge Functions (every such write is still audited by trigger). This
-- drops the default TRUNCATE, REFERENCES, TRIGGER and MAINTAIN privileges.
revoke all on table public.channel_categories, public.channels, public.channel_streams from service_role;
grant select, insert, update, delete on table
  public.channel_categories, public.channels, public.channel_streams to service_role;

-- Catalogue version: service_role may read it but never change it. Only the
-- SECURITY DEFINER trigger function (running as the table owner) bumps it.
revoke all on table public.catalogue_meta from service_role;
grant select on table public.catalogue_meta to service_role;

-- -----------------------------------------------------------------------------
-- 8. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.channel_categories enable row level security;
alter table public.channels           enable row level security;
alter table public.channel_streams    enable row level security;
alter table public.catalogue_meta     enable row level security;
alter table public.admin_users        enable row level security;
alter table public.admin_audit_log    enable row level security;

-- 8.1 catalogue_meta: version is not sensitive; apps poll it.
create policy catalogue_meta_select_public on public.catalogue_meta
  for select to anon, authenticated using (true);

-- 8.2 channel_categories
create policy channel_categories_select_anon on public.channel_categories
  for select to anon using (is_active);
create policy channel_categories_select_authenticated on public.channel_categories
  for select to authenticated using (is_active or (select private.is_admin()));
create policy channel_categories_insert_admin on public.channel_categories
  for insert to authenticated with check ((select private.is_admin()));
create policy channel_categories_update_admin on public.channel_categories
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy channel_categories_delete_admin on public.channel_categories
  for delete to authenticated using ((select private.is_admin()));

-- 8.3 channels (visible only when the channel AND its category are active)
create policy channels_select_anon on public.channels
  for select to anon using (
    is_active
    and exists (select 1 from public.channel_categories cc where cc.id = category_id and cc.is_active)
  );
create policy channels_select_authenticated on public.channels
  for select to authenticated using (
    (is_active and exists (select 1 from public.channel_categories cc where cc.id = category_id and cc.is_active))
    or (select private.is_admin())
  );
create policy channels_insert_admin on public.channels
  for insert to authenticated with check ((select private.is_admin()));
create policy channels_update_admin on public.channels
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy channels_delete_admin on public.channels
  for delete to authenticated using ((select private.is_admin()));

-- 8.4 channel_streams
--     INTENTIONALLY readable by anon AND authenticated (see security notes 1-2).
--     Active stream URLs and headers are publicly retrievable with the anon key.
--     Nested RLS on public.channels (and categories) means a stream is only
--     visible when its channel and category are visible too.
create policy channel_streams_select_anon on public.channel_streams
  for select to anon using (
    is_active
    and exists (select 1 from public.channels c where c.id = channel_id)
  );
create policy channel_streams_select_authenticated on public.channel_streams
  for select to authenticated using (
    (is_active and exists (select 1 from public.channels c where c.id = channel_id))
    or (select private.is_admin())
  );
create policy channel_streams_insert_admin on public.channel_streams
  for insert to authenticated with check ((select private.is_admin()));
create policy channel_streams_update_admin on public.channel_streams
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy channel_streams_delete_admin on public.channel_streams
  for delete to authenticated using ((select private.is_admin()));

-- 8.5 admin_users: RLS on, deliberately NO policies and NO grants -> no API role
--     (anon, authenticated or service_role) can read or write it. Rows are
--     managed only by the database owner through the SQL Editor, never through
--     service_role, and every change is recorded in admin_audit_log (actor_id is
--     null for those).

-- 8.6 admin_audit_log: administrators may read; nobody may write via the API.
--     Rows are inserted only by private.log_catalogue_change().
create policy admin_audit_log_select_admin on public.admin_audit_log
  for select to authenticated using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- 9. Self-checks: abort (and roll back everything) if the security posture is
--    not what this migration intends.
-- -----------------------------------------------------------------------------
do $assert$
declare
  v_tbl text;
  v_sr    oid;
  v_owner oid;
  v_seq   text;
  v_pg    integer := pg_catalog.current_setting('server_version_num')::integer;
begin
  -- RLS enabled on all six tables
  foreach v_tbl in array array[
    'channel_categories','channels','channel_streams',
    'catalogue_meta','admin_users','admin_audit_log'
  ] loop
    if not (select c.relrowsecurity from pg_catalog.pg_class c
            where c.oid = ('public.' || v_tbl)::pg_catalog.regclass) then
      raise exception 'RLS is not enabled on public.%', v_tbl;
    end if;
  end loop;

  -- FORCE RLS must be off on admin_users so the definer-owner can read it
  if (select c.relforcerowsecurity from pg_catalog.pg_class c
      where c.oid = 'public.admin_users'::pg_catalog.regclass) then
    raise exception 'FORCE RLS is enabled on public.admin_users; private.is_admin() would return false';
  end if;

  -- private.is_admin() must be owned by the same role that owns admin_users
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'is_admin'
      and p.prosecdef
      and p.proowner = (select c.relowner from pg_catalog.pg_class c
                        where c.oid = 'public.admin_users'::pg_catalog.regclass)
  ) then
    raise exception 'private.is_admin() is not a SECURITY DEFINER function owned by the admin_users owner';
  end if;

  -- Client roles must have no privileges on admin_users or the private schema internals
  if pg_catalog.has_table_privilege('anon', 'public.admin_users', 'select,insert,update,delete')
     or pg_catalog.has_table_privilege('authenticated', 'public.admin_users', 'select,insert,update,delete') then
    raise exception 'anon/authenticated must have no privileges on public.admin_users';
  end if;
  if pg_catalog.has_schema_privilege('anon', 'private', 'usage') then
    raise exception 'anon must not have USAGE on schema private';
  end if;
  if pg_catalog.has_function_privilege('anon', 'private.is_admin()', 'execute') then
    raise exception 'anon must not be able to execute private.is_admin()';
  end if;

  -- ---------------------------------------------------------------------------
  -- service_role (BYPASSRLS): table privileges are its only guard
  -- ---------------------------------------------------------------------------
  v_sr := (select r.oid from pg_catalog.pg_roles r where r.rolname = 'service_role');
  if v_sr is null then
    raise exception 'role service_role not found';
  end if;

  -- (a) no privilege of any kind on admin_users / admin_audit_log
  foreach v_tbl in array array['admin_users', 'admin_audit_log'] loop
    if pg_catalog.has_table_privilege('service_role', 'public.' || v_tbl,
         'select,insert,update,delete,truncate,references,trigger')
       or exists (
         select 1
         from pg_catalog.pg_class c
         cross join lateral pg_catalog.aclexplode(c.relacl) a
         where c.oid = ('public.' || v_tbl)::pg_catalog.regclass
           and a.grantee = v_sr
       ) then
      raise exception 'service_role must have no privileges on public.%', v_tbl;
    end if;
  end loop;

  -- (b) no access to the audit identity sequence for any API role
  v_seq := pg_catalog.pg_get_serial_sequence('public.admin_audit_log', 'id');
  if v_seq is null then
    raise exception 'identity sequence for public.admin_audit_log.id not found';
  end if;
  if pg_catalog.has_sequence_privilege('service_role',   v_seq, 'select,update,usage')
     or pg_catalog.has_sequence_privilege('anon',          v_seq, 'select,update,usage')
     or pg_catalog.has_sequence_privilege('authenticated', v_seq, 'select,update,usage')
     or exists (
       select 1
       from pg_catalog.pg_class c
       cross join lateral pg_catalog.aclexplode(c.relacl) a
       where c.oid = v_seq::pg_catalog.regclass
         and a.grantee = v_sr
     ) then
    raise exception 'API roles must have no privileges on the audit identity sequence %', v_seq;
  end if;

  -- (c) catalogue_meta: SELECT-only for service_role (effective privileges + ACL)
  if not pg_catalog.has_table_privilege('service_role', 'public.catalogue_meta', 'select') then
    raise exception 'service_role must keep SELECT on public.catalogue_meta';
  end if;
  if pg_catalog.has_table_privilege('service_role', 'public.catalogue_meta',
       'insert,update,delete,truncate,references,trigger') then
    raise exception 'service_role must be SELECT-only on public.catalogue_meta';
  end if;
  if v_pg >= 170000
     and pg_catalog.has_table_privilege('service_role', 'public.catalogue_meta', 'maintain') then
    raise exception 'service_role must not have MAINTAIN on public.catalogue_meta';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_class c
    cross join lateral pg_catalog.aclexplode(c.relacl) a
    where c.oid = 'public.catalogue_meta'::pg_catalog.regclass
      and a.grantee = v_sr
      and (a.privilege_type <> 'SELECT' or a.is_grantable)
  ) then
    raise exception 'service_role ACL on public.catalogue_meta must be exactly SELECT (no grant option)';
  end if;

  -- (d) catalogue tables: exactly SELECT, INSERT, UPDATE, DELETE for service_role
  foreach v_tbl in array array['channel_categories', 'channels', 'channel_streams'] loop
    if not (pg_catalog.has_table_privilege('service_role', 'public.' || v_tbl, 'select')
        and pg_catalog.has_table_privilege('service_role', 'public.' || v_tbl, 'insert')
        and pg_catalog.has_table_privilege('service_role', 'public.' || v_tbl, 'update')
        and pg_catalog.has_table_privilege('service_role', 'public.' || v_tbl, 'delete')) then
      raise exception 'service_role must keep SELECT/INSERT/UPDATE/DELETE on public.%', v_tbl;
    end if;
    if pg_catalog.has_table_privilege('service_role', 'public.' || v_tbl,
         'truncate,references,trigger') then
      raise exception 'service_role must not have TRUNCATE, REFERENCES or TRIGGER on public.%', v_tbl;
    end if;
    if v_pg >= 170000
       and pg_catalog.has_table_privilege('service_role', 'public.' || v_tbl, 'maintain') then
      raise exception 'service_role must not have MAINTAIN on public.%', v_tbl;
    end if;
    if exists (
      select 1
      from pg_catalog.pg_class c
      cross join lateral pg_catalog.aclexplode(c.relacl) a
      where c.oid = ('public.' || v_tbl)::pg_catalog.regclass
        and a.grantee = v_sr
        and (a.privilege_type not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE') or a.is_grantable)
    ) then
      raise exception 'service_role ACL on public.% must be exactly SELECT, INSERT, UPDATE, DELETE (no grant option)', v_tbl;
    end if;
  end loop;

  -- ---------------------------------------------------------------------------
  -- Audit integrity for anon / authenticated (admins included: they are the
  -- authenticated role and get no write privilege on the audit log)
  -- ---------------------------------------------------------------------------
  if pg_catalog.has_table_privilege('anon', 'public.admin_audit_log',
       'select,insert,update,delete,truncate')
     or pg_catalog.has_table_privilege('authenticated', 'public.admin_audit_log',
       'insert,update,delete,truncate') then
    raise exception 'audit records must be read-only (and admin-only readable) for API roles';
  end if;

  foreach v_tbl in array array[
    'channel_categories','channels','channel_streams',
    'catalogue_meta','admin_users','admin_audit_log'
  ] loop
    if pg_catalog.has_table_privilege('anon', 'public.' || v_tbl, 'insert,update,delete,truncate')
       or pg_catalog.has_table_privilege('authenticated', 'public.' || v_tbl, 'truncate') then
      raise exception 'anon/authenticated have forbidden write or TRUNCATE privileges on public.%', v_tbl;
    end if;
  end loop;

  -- ---------------------------------------------------------------------------
  -- Audit and versioning triggers exist and are enabled
  -- ---------------------------------------------------------------------------
  foreach v_tbl in array array['channel_categories', 'channels', 'channel_streams', 'admin_users'] loop
    if not exists (
      select 1 from pg_catalog.pg_trigger t
      where t.tgrelid = ('public.' || v_tbl)::pg_catalog.regclass
        and t.tgname = v_tbl || '_audit'
        and t.tgenabled = 'O'
        and not t.tgisinternal
    ) then
      raise exception 'audit trigger missing or disabled on public.%', v_tbl;
    end if;
  end loop;

  foreach v_tbl in array array['channel_categories', 'channels', 'channel_streams'] loop
    if not exists (
      select 1 from pg_catalog.pg_trigger t
      where t.tgrelid = ('public.' || v_tbl)::pg_catalog.regclass
        and t.tgname = v_tbl || '_bump_version'
        and t.tgenabled = 'O'
        and not t.tgisinternal
    ) then
      raise exception 'version trigger missing or disabled on public.%', v_tbl;
    end if;
  end loop;

  -- ---------------------------------------------------------------------------
  -- Trigger functions are SECURITY DEFINER and owned by the owner of the table
  -- they write to (so they keep the privileges they need, independent of
  -- service_role), and that owner is not service_role.
  -- ---------------------------------------------------------------------------
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'log_catalogue_change' and p.prosecdef
      and p.proowner = (select c.relowner from pg_catalog.pg_class c
                        where c.oid = 'public.admin_audit_log'::pg_catalog.regclass)
  ) then
    raise exception 'private.log_catalogue_change() must be SECURITY DEFINER and owned by the admin_audit_log owner';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'bump_catalogue_version' and p.prosecdef
      and p.proowner = (select c.relowner from pg_catalog.pg_class c
                        where c.oid = 'public.catalogue_meta'::pg_catalog.regclass)
  ) then
    raise exception 'private.bump_catalogue_version() must be SECURITY DEFINER and owned by the catalogue_meta owner';
  end if;

  if (select c.relowner from pg_catalog.pg_class c
      where c.oid = 'public.admin_audit_log'::pg_catalog.regclass) = v_sr then
    raise exception 'service_role must not own public.admin_audit_log';
  end if;

  -- The owner (which the definer trigger functions run as) must still hold what
  -- they need: INSERT on the audit log, USAGE on its identity sequence, and
  -- SELECT + UPDATE on catalogue_meta.
  v_owner := (select c.relowner from pg_catalog.pg_class c
              where c.oid = 'public.admin_audit_log'::pg_catalog.regclass);
  if not pg_catalog.has_table_privilege(v_owner, 'public.admin_audit_log', 'insert')
     or not pg_catalog.has_sequence_privilege(v_owner, v_seq, 'usage') then
    raise exception 'audit trigger owner lacks INSERT on admin_audit_log or USAGE on its identity sequence';
  end if;
  if not pg_catalog.has_table_privilege(v_owner, 'public.catalogue_meta', 'select')
     or not pg_catalog.has_table_privilege(v_owner, 'public.catalogue_meta', 'update') then
    raise exception 'version trigger owner lacks SELECT/UPDATE on catalogue_meta';
  end if;
end
$assert$;

commit;

-- =============================================================================
-- AFTER APPLYING (run manually, NOT part of this migration)
--
-- A. As the DATABASE OWNER in the SQL Editor (not via service_role), grant the
--    first administrator after creating the user in Auth:
--
--      insert into public.admin_users (user_id, note)
--      select id, 'initial owner'
--      from auth.users
--      where email = 'YOUR_ADMIN_EMAIL';
--
-- B. Confirm in the dashboard (Settings > API / Data API) that "private" is
--    NOT in the exposed schemas list.
--
-- C. Non-destructive privilege checks (each in its own transaction, rolled back).
--    Every one of these should fail with "permission denied":
--
--      begin; set local role authenticated;
--        select set_config('request.jwt.claims',
--          '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
--        select * from public.admin_users;
--      rollback;
--
--      begin; set local role authenticated;
--        select set_config('request.jwt.claims',
--          '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
--        insert into public.admin_users (user_id)
--        values ('00000000-0000-0000-0000-000000000001');
--      rollback;
--
--      begin; set local role anon;
--        insert into public.channel_categories (slug, name) values ('x', 'x');
--      rollback;
--
--      begin; set local role service_role; select * from public.admin_audit_log;                         rollback;
--      begin; set local role service_role; delete from public.admin_audit_log;                           rollback;
--      begin; set local role service_role; insert into public.admin_users (user_id)
--                                          values ('00000000-0000-0000-0000-000000000001');              rollback;
--      begin; set local role service_role; truncate public.channels;                                     rollback;
--      begin; set local role service_role; update public.catalogue_meta set version = 999;               rollback;
--      begin; set local role service_role; insert into public.catalogue_meta (id) values (2);            rollback;
--      begin; set local role service_role; delete from public.catalogue_meta;                            rollback;
--
-- D. Positive audit/version test (rolled back; run as the database owner).
--    Expect one INSERT audit row for channel_categories and version = 2:
--
--      begin;
--        set local role service_role;
--        insert into public.channel_categories (slug, name) values ('zz-audit-test', 'ZZ audit test');
--        reset role;
--        select action, table_name, actor_role
--          from public.admin_audit_log order by id desc limit 1;
--        select version from public.catalogue_meta;
--      rollback;
--
-- E. Rerun the Supabase security and performance advisors.
--
-- AUDIT SCOPE NOTE: the database owner (postgres) is a trusted authority and can
-- modify the database and audit records. TRUNCATE by the owner bumps the catalogue
-- version but is not written to the audit log. API roles (anon, authenticated,
-- service_role) cannot write, truncate or read-modify audit records.
-- =============================================================================
