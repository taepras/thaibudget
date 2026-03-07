# Database Migration: Hierarchical Budgetary Units

This migration converts the budgetary unit structure to match the category pattern, creating a unified hierarchical table.

For Render production rollout instructions, see `db/RENDER_DB_UPDATE_README.md`.

## What Changed

### Before
- Two separate tables: `dim_ministry` and `dim_budgetary_unit`
- `dim_budgetary_unit` had a `ministry_id` foreign key
- Ministries and budgetary units were separate entities

### After
- Single table: `dim_budgetary_unit` (hierarchical)
- Ministries are level 1 (parent_id = null)
- Budgetary units are level 2 (parent_id = ministry id)
- Closure table `dim_budgetary_unit_path` for efficient hierarchical queries

## Migration Steps

### 1. Run the Migration (Existing Data)

```bash
cd db
psql $DATABASE_URL -f migrate_budgetary_unit_hierarchy.sql
```

This will:
- Create new hierarchical structure
- Migrate ministries as level 1
- Migrate budgetary units as level 2
- Build closure table paths
- Update fact_budget_item references
- Drop old tables

### 2. Fresh Import (New Database)

The updated schema and import script already support the new structure:

```bash
# Create database with new schema
psql $DATABASE_URL -f db/schema.sql

# Import data
cd server
npm run import -- --file ../data/data-all-years.csv --reset
```

## Structure

### dim_budgetary_unit
```sql
id        | bigint  | primary key
name      | text    | not null
parent_id | bigint  | references dim_budgetary_unit(id), null for level 1 (ministries)
level     | smallint| 1 (ministry) or 2 (budgetary unit)
```

### dim_budgetary_unit_path
```sql
ancestor_id   | bigint  | references dim_budgetary_unit(id)
descendant_id | bigint  | references dim_budgetary_unit(id)
depth         | smallint| 0 (self), 1 (parent-child)
```

## Benefits

1. **Consistent Pattern**: Budgetary units now work exactly like categories
2. **Simplified Queries**: Single join instead of two
3. **Efficient Filtering**: Closure table enables fast hierarchical queries
4. **Cleaner API**: One hierarchical grouping instead of two separate ones
5. **Better UI**: Drill-down navigation works the same for both dimensions

## Code Changes

### Import Script
- Removed separate ministry creation
- Creates hierarchical budgetary units in one pass
- Builds closure table during import

### API Handler
- `group=budgetary_unit` shows level 1 (ministries) by default
- Drilling into a ministry shows level 2 (units)
- `filterMinistryId` uses path table for hierarchical filtering

### Frontend
- Removed `ministry` from hierarchy
- Start with `groupBy='budgetary_unit'`
- Navigation automatically progresses through levels
