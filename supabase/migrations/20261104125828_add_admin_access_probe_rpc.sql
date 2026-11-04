create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce((select private.is_admin()), false);
$function$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;

comment on function public.is_current_user_admin() is
  'Returns whether the current authenticated user is in the private admin allow-list. Invoker wrapper; delegates only to private.is_admin().';
