-- Approved read-only availability endpoint. Apply once in Mosaic SQL Editor.
begin;
create function public.monitor_health()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select true;
$$;
revoke execute on function public.monitor_health() from public, anon, authenticated;
grant execute on function public.monitor_health() to anon;
commit;
