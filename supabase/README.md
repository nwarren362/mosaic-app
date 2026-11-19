# Mosaic migrations

Production adopted version 20261119000000 and applied 20261119000100 on 19 November 2026. Do not repeat either operation there.

The first standard migration captures the verified application schema on 19 November 2026, after the earlier manually applied repairs. Historical SQL in `docs/db/migrations` remains evidence; do not copy those scripts into this directory or replay them after the baseline.

- **Fresh Supabase database:** apply `20261119000000_application_baseline.sql`, then subsequent migrations in timestamp order. The destination must have the normal Supabase roles, Auth, Storage and extensions schema. Unexpected global/public default grants for the executor or postgres cause the restore to refuse rather than silently widen access; review those separately. This is an application baseline, not a replacement for the managed platform, bucket configuration, Auth settings or image backups.
- **Existing Mosaic production database:** never execute the baseline CREATE statements. The reviewed `docs/db/adopt-20261119-baseline.sql` compares columns, constraints, indexes, functions, policies, relations, views and grants to the captured baseline before recording its version in private migration history. It refuses an existing history schema or drift. Apply only as an explicitly authorised release, with a fresh preflight. This is an adoption record, not a claim about original object-creation dates.
- **Following changes:** use timestamped, reviewed migrations here. The Supabase CLI records migrations it applies. If an authorised release uses the management API instead, insert the exact version/name into `supabase_migrations.schema_migrations` in the same transaction as the change. Never mark an unapplied change as applied or silently repair history.
- Every new function must declare its intended search path and explicit EXECUTE grants. Existing PostgreSQL default EXECUTE permissions are not automatically safe for new RPCs.

The native rehearsal checks platform contracts and schema/permission fidelity. A full hosted Supabase rebuild has not been exercised. Bucket rows/files and service configuration remain separate deployment prerequisites.

Commands from the repository root:

```sh
node scripts/db/schema-baseline.mjs docs/db/audit/catalog-2026-11-19.json /private/tmp/mosaic-baseline-check.sql
python3 scripts/db/prepare-baseline-adoption.py
node scripts/db/test-schema-baseline.mjs docs/db/audit/catalog-2026-11-19.json
node scripts/db/test-application-privileges.mjs
```

The generator outputs should match the reviewed baseline/adoption files; inspect differences rather than overwriting a released baseline. Native tests use private Unix sockets and disposable clusters. The normal `npm run dev` database selection remains controlled by its environment.

Reference: [Supabase migration deployment and history](https://supabase.com/docs/guides/deployment/database-migrations).
