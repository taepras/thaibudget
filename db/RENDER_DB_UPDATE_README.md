# Render Database Update Guide

This guide explains how to update the Render PostgreSQL database for the new hierarchical `budgetary_unit` model.

## Scope

Use this guide when deploying the database change that:
- removes `dim_ministry`
- uses hierarchical `dim_budgetary_unit` (`parent_id`, `level`)
- adds `dim_budgetary_unit_path`

## Choose Your Strategy

1. `Fresh Rebuild` (recommended): drop/recreate schema, then import CSV.
2. `In-Place Migration`: keep existing data and run migration SQL.

If you can re-import from CSV, use `Fresh Rebuild`.

## Prerequisites

- Local machine has `psql`, `pg_dump`, Node.js 18+.
- You can access Render DB connection string.
- Repo is up to date.
- File `data/data-all-years.csv` is present locally.

## 1. Get Render Database URL

From Render Dashboard:
- Open your PostgreSQL service.
- Copy the external connection string.
- Save it to env var:

```bash
export RENDER_DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require"
```

## 2. Backup Current Production Database

Always backup before any schema migration.

```bash
mkdir -p backups
pg_dump "$RENDER_DATABASE_URL" -Fc -f "backups/render-pre-budgetary-hierarchy.dump"
```

## 3A. Fresh Rebuild Path (Recommended)

### Step A1: Recreate `public` schema

```bash
psql "$RENDER_DATABASE_URL" -v ON_ERROR_STOP=1 -c "drop schema public cascade; create schema public;"
```

### Step A2: Apply latest schema

Run from repository root:

```bash
psql "$RENDER_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
```

### Step A3: Import data using server script

Run from `server/` so relative `--file` path resolves correctly.

```bash
cd server
npm ci
DATABASE_URL="$RENDER_DATABASE_URL" npm run import -- --file ../data/data-all-years.csv --reset
```

## 3B. In-Place Migration Path (Keep Existing Data)

Use this only if you cannot rebuild from CSV.

```bash
psql "$RENDER_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrate_budgetary_unit_hierarchy.sql
```

Then deploy backend code that matches the new schema.

## 4. Deploy Backend Service on Render

- Push latest code to the branch used by Render.
- Trigger deploy for API service.
- Ensure API service `DATABASE_URL` points to updated Render DB.

## 5. Verify Migration

### SQL checks

```bash
psql "$RENDER_DATABASE_URL" -c "select level, count(*) from dim_budgetary_unit group by level order by level;"
psql "$RENDER_DATABASE_URL" -c "select count(*) from dim_budgetary_unit_path;"
psql "$RENDER_DATABASE_URL" -c "select count(*) from fact_budget_item;"
```

Expected:
- `level=1` rows exist (ministries)
- `level=2` rows exist (budgetary units)
- path table has rows
- fact table has imported rows

### API checks

```bash
curl -s "https://<your-api>.onrender.com/health"
curl -s "https://<your-api>.onrender.com/api/breakdown?year=2569&group=budgetary_unit"
curl -s "https://<your-api>.onrender.com/api/breakdown?year=2569&group=budgetary_unit&filterBudgetaryUnitPath=<level1_id>"
```

Note:
- The frontend now should use `filterBudgetaryUnitPath`.
- `filterMinistryId` remains legacy/backward-compatible in backend only.

## 6. Frontend Deployment Notes

If your frontend is hosted separately on Render:
- Ensure `REACT_APP_API_URL` points to the updated API service URL.
- Redeploy frontend after backend rollout.

## Rollback Plan

If anything fails after migration:

1. Stop traffic or scale down API temporarily.
2. Restore backup:

```bash
pg_restore -d "$RENDER_DATABASE_URL" --clean --if-exists "backups/render-pre-budgetary-hierarchy.dump"
```

3. Redeploy the previous backend revision.

## Common Issues

1. `relation "dim_budgetary_unit_path" does not exist`
- Cause: import script ran before applying new schema.
- Fix: run Step A1 + A2 first.

2. Empty `/api/breakdown?group=budgetary_unit`
- Cause: old backend code still running or wrong filters.
- Fix: redeploy backend and verify query uses `filterBudgetaryUnitPath`.

3. SSL connection errors to Render DB
- Ensure connection string includes `sslmode=require`.
