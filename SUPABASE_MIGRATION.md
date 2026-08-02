# Supabase PostgreSQL Migration Runbook

## 1) Prepare environment variables

Update `.env` from `.env.example` with real values:

- Target PostgreSQL: `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `DB_SSL=true`
- Source SQL Server (one-time): `SOURCE_DB_SERVER`, `SOURCE_DB_PORT`, `SOURCE_DB_DATABASE`, `SOURCE_DB_USER`, `SOURCE_DB_PASSWORD`

Important:

- Keep `.env` local only (already ignored by git).
- Rotate exposed API keys before production deploy.

## 2) Create free Supabase project

1. Create a project in Supabase free tier.
2. Open project settings and collect PostgreSQL connection values.
3. Put those values into local `.env`.

## 3) Import schema first

Use `database_postgres.sql` as source of truth schema.

Suggested order:

1. Open Supabase SQL Editor.
2. Run `database_postgres.sql`.

## 4) Migrate data from SQL Server to PostgreSQL

Run:

```bash
npm run db:migrate:sqlserver-to-pg
```

What it does:

- Reads tables in FK-safe order.
- Truncates target table (`RESTART IDENTITY CASCADE`).
- Inserts rows in batches.
- Resets sequence values when needed.

## 5) Verify data and referential integrity

Run:

```bash
npm run db:verify:pg
```

Check:

- Row counts per main table.
- Integrity checks on `users -> courses -> lessons` and `users/quizzes -> quiz_results`.

## 6) Deploy API to Render/Railway

Set the same DB variables in Render/Railway service secrets:

- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSL=true`

Deploy and validate:

1. Health endpoint responds 200.
2. One read endpoint (e.g. users/courses) responds 200.
3. One write flow (create course or enrollment) succeeds.

## 7) Rollback strategy

If migration validation fails:

1. Stop write traffic to cloud DB.
2. Restore Supabase from snapshot/backup.
3. Re-point app env back to previous DB.
4. Re-run migration after fixing failed table/data type mapping.

## 8) Data type mapping reference

- `uniqueidentifier` -> `uuid` or `varchar`
- `bit` -> `boolean`
- `datetime` / `datetime2` -> `timestamp` / `timestamptz`
- `nvarchar` -> `text` / `varchar`
- `int identity` -> `serial` / `generated identity`
