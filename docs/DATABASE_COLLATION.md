# Database collation & text-index integrity

## What happened (2026-06-07)

Production forecast pages were returning **404 when fetched by slug** but loaded
fine by id (e.g. `/forecasts/ariel-galili-...-2026`). Root cause: the unique
btree index `predictions_slug_key` was **corrupted by a glibc collation version
change**.

PostgreSQL's libc collations (`en_US.utf8`) define how text sorts. Text btree
indexes are physically ordered by that collation. When the underlying glibc
changes (e.g. a Debian base-image rebuild), the sort order can change, and
existing text indexes silently no longer find rows that exist:

- `WHERE id = $1` (primary key) → row found.
- `WHERE slug = $1` via the index → **0 rows**, even for a value read straight
  from the column.
- The same query forced to a sequential scan (`SET enable_indexscan = off`) →
  finds the row.

The trigger was the **mutable `pgvector/pgvector:pg16` image tag**: an upstream
rebuild shipped a newer Debian/glibc/ICU, and a redeploy pulled it under the
existing data directory. `pg_database.datcollversion` was `NULL` (never
recorded), so Postgres emitted no warning.

Blast radius at discovery: ~25% of recent forecast slugs were unreachable, plus
any other text index (usernames, tag slugs, emails).

## The fix (already applied to prod + staging, 2026-06-12)

Two steps were applied in sequence:

**Step 1 — rebuild indexes against the current collation (non-blocking):**

```sql
REINDEX DATABASE CONCURRENTLY daatan;          -- staging: daatan_staging
```

**Step 2 — record the current collation version in the catalog:**

`ALTER DATABASE ... REFRESH COLLATION VERSION` fails with
`invalid collation version change` when `datcollversion` is NULL (PostgreSQL 16
refuses to transition from NULL). The workaround is a direct catalog update:

```sql
UPDATE pg_catalog.pg_database
   SET datcollversion = pg_database_collation_actual_version(oid)
 WHERE datname = 'daatan';                     -- staging: daatan_staging
```

This returned `UPDATE 1` on both prod and staging, setting `datcollversion` to
`2.36` (glibc 2.36). Postgres no longer emits a collation-mismatch warning on
startup.

Verify no rows are invisible to a text index:

```sql
SELECT count(*) FROM predictions p
WHERE p.slug IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM predictions x WHERE x.slug = p.slug);  -- expect 0
```

## Prevention

1. **The postgres image is pinned by digest** in `docker-compose.yml`,
   `docker-compose.prod.yml`, and `docker-compose.staging.yml`:
   `pgvector/pgvector:pg16@sha256:7d400e340efb42f4d8c9c12c6427adb253f726881a9985d2a471bf0eed824dff`
   (glibc 2.36 / Debian 12 / PostgreSQL 16.13). A pinned digest cannot silently
   swap glibc/ICU, so the collation cannot drift underneath the data.

2. **When you deliberately bump the digest** (security patches, PG upgrade),
   treat collation as part of the migration:
   - After the new image is live, run `REINDEX DATABASE CONCURRENTLY` on prod
     **and** staging.
   - Run the verify query above (expect 0) for slug and username.
   - Spot-check a forecast page by slug over HTTP.

## How to run on the servers (SSM)

Prod (instance `i-04ea44d4243d35624`, container `daatan-postgres`, db `daatan`):

```bash
docker exec daatan-postgres psql -U daatan -d daatan -c "REINDEX DATABASE CONCURRENTLY daatan;"
```

Staging (instance `i-0406d237ca5d92cdf`, container `daatan-postgres-staging`, db `daatan_staging`):

```bash
docker exec daatan-postgres-staging psql -U daatan -d daatan_staging -c "REINDEX DATABASE CONCURRENTLY daatan_staging;"
```

`REINDEX ... CONCURRENTLY` cannot run inside a transaction block (run it as a
single `psql -c`, not inside `BEGIN`).
