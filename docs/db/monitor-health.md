# Read-only database health check

`migrations/20261112_monitor_health.sql` adds the approved availability endpoint for the private `nwarren362/supabase-project-monitor` utility.

Apply the SQL once using Mosaic's Supabase SQL Editor as an administrator. It runs in a transaction and intentionally fails if that function already exists: inspect any existing definition rather than overwrite it. No application rows or table permissions change. There is no frontend deployment.

The no-argument SQL STABLE function returns JSON `true` through `GET /rest/v1/rpc/monitor_health`. It is SECURITY INVOKER with an empty search path, has no table references, and grants EXECUTE only to anon (besides owner privileges). It exposes database availability publicly, never tenant data. It is not an application authorization check.

Verify using the monitor's public/publishable key, never a service-role key. The response must be HTTP 200 and JSON true. Check the deployed function body, volatility, security invoker flag and explicit grants in SQL Editor. STABLE also allows PostgREST's read-only GET invocation. Confirm authenticated has no inherited/default EXECUTE grant. Run `NOTIFY pgrst, 'reload schema';` if the new endpoint is initially missing, then retry.

The monitor repository documents secrets, its six-hour schedule, tests, notification setup and recovery. Do not commit keys here.

## Rollback

Disable the external monitoring workflow first. Then run in Mosaic SQL Editor:

```sql
begin;
revoke execute on function public.monitor_health() from anon;
drop function public.monitor_health();
commit;
```

No application data cleanup is required. Remove the migration only if it has never been applied; retain deployed migration history.
