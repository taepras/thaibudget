-- Performance indexes migration
-- Run once against the live database to significantly speed up breakdown and dimensions queries.
-- CONCURRENTLY means Postgres builds each index without locking writes.

-- 1. Composite indexes on fact_budget_item: (fiscal_year, <dim_fk>)
--    The main breakdown query always filters by fiscal_year + one dimension FK.
--    A composite index is far more selective than two separate single-column indexes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fact_year_bu
    ON fact_budget_item (fiscal_year, budgetary_unit_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fact_year_category
    ON fact_budget_item (fiscal_year, category_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fact_year_budget_plan
    ON fact_budget_item (fiscal_year, budget_plan_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fact_year_output
    ON fact_budget_item (fiscal_year, output_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fact_year_project
    ON fact_budget_item (fiscal_year, project_id);

-- 2. Composite covering indexes on the closure tables.
--    breakdown.js joins: f.budgetary_unit_id = bu_group_path.descendant_id (then reads ancestor_id)
--    and: f.category_id = cp_group.descendant_id (then reads ancestor_id).
--    A (descendant_id, ancestor_id) index makes these lookups index-only scans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bupath_desc_anc
    ON dim_budgetary_unit_path (descendant_id, ancestor_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catpath_desc_anc
    ON dim_category_path (descendant_id, ancestor_id);

-- 3. Index on dim_budgetary_unit(level) and dim_category(level).
--    Every query that groups by budgetary_unit or category filters WHERE level = $N.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bu_level
    ON dim_budgetary_unit (level);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cat_level
    ON dim_category (level);

-- 4. Index on dim_category(parent_id) used by the collapseCategories N+1 loop
--    and isTerminal child checks.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cat_parent_id
    ON dim_category (parent_id);
