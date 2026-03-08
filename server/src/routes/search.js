import { query } from "../db.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function registerSearchRoute(app) {
  app.get("/api/search", async (req, res) => {
    const q = req.query.q;
    if (!q || q.trim() === "") {
      return res.status(400).json({ error: "q (search query) is required" });
    }

    const rawYears = req.query.year
      ? Array.isArray(req.query.year)
        ? req.query.year
        : [req.query.year]
      : [];
    const years = rawYears.map(Number).filter(Number.isInteger);

    const rawLimit = Number(req.query.limit);
    const limit = Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

    const pattern = `%${q.trim()}%`;

    const buildParams = (extraParams = []) => {
      const base = [pattern];
      if (years.length > 0) base.push(years);
      for (const p of extraParams) base.push(p);
      return base;
    };

    const buildYearCond = (paramOffset = 2) => {
      if (years.length === 0) return "";
      return `AND f.fiscal_year = ANY($${paramOffset})`;
    };

    try {
      const [
        budgetaryUnitResult,
        budgetPlanResult,
        outputResult,
        projectResult,
        categoryResult,
        itemResult,
      ] = await Promise.all([
        // Budgetary units — one row per matched unit; parent (ministry) returned as a
        // separate parallel array so callers know the hierarchy level.
        query(
          `
          SELECT
            bu.id,
            bu.name,
            bu.level,
            bu.parent_id,
            CASE WHEN bu_parent.id IS NOT NULL
              THEN ARRAY[bu_parent.id]
              ELSE ARRAY[]::bigint[]
            END AS parent_budgetary_unit_ids,
            CASE WHEN bu_parent.name IS NOT NULL
              THEN ARRAY[bu_parent.name]
              ELSE ARRAY[]::text[]
            END AS parent_budgetary_unit_names,
            array_agg(DISTINCT f.fiscal_year ORDER BY f.fiscal_year) AS fiscal_years,
            SUM(f.amount) AS total_amount,
            COUNT(DISTINCT f.id) AS item_count
          FROM dim_budgetary_unit bu
          JOIN fact_budget_item f ON f.budgetary_unit_id = bu.id
          LEFT JOIN dim_budgetary_unit bu_parent ON bu.parent_id = bu_parent.id
          WHERE bu.name ILIKE $1
            ${buildYearCond(2)}
          GROUP BY bu.id, bu.name, bu.level, bu.parent_id, bu_parent.id, bu_parent.name
          ORDER BY bu.level, bu.name
          LIMIT ${limit}
          `,
          buildParams()
        ),

        // Budget plans — one row per (budget_plan, budgetary_unit) pair
        query(
          `
          SELECT
            bp.id,
            bp.name,
            CASE WHEN bu_parent.id IS NOT NULL
              THEN ARRAY[bu_parent.id, bu.id]
              ELSE ARRAY[bu.id]
            END AS budgetary_unit_ids,
            CASE WHEN bu_parent.name IS NOT NULL
              THEN ARRAY[bu_parent.name, bu.name]
              ELSE ARRAY[bu.name]
            END AS budgetary_unit_names,
            array_agg(DISTINCT f.fiscal_year ORDER BY f.fiscal_year) AS fiscal_years,
            SUM(f.amount) AS total_amount,
            COUNT(DISTINCT f.id) AS item_count
          FROM dim_budget_plan bp
          JOIN fact_budget_item f ON f.budget_plan_id = bp.id
          JOIN dim_budgetary_unit bu ON f.budgetary_unit_id = bu.id
          LEFT JOIN dim_budgetary_unit bu_parent ON bu.parent_id = bu_parent.id
          WHERE bp.name ILIKE $1
            ${buildYearCond(2)}
          GROUP BY bp.id, bp.name, bu.id, bu.name, bu_parent.id, bu_parent.name
          ORDER BY bp.name, bu_parent.name NULLS FIRST, bu.name
          LIMIT ${limit}
          `,
          buildParams()
        ),

        // Outputs — one row per (output, budgetary_unit) pair
        query(
          `
          SELECT
            o.id,
            o.name,
            CASE WHEN bu_parent.id IS NOT NULL
              THEN ARRAY[bu_parent.id, bu.id]
              ELSE ARRAY[bu.id]
            END AS budgetary_unit_ids,
            CASE WHEN bu_parent.name IS NOT NULL
              THEN ARRAY[bu_parent.name, bu.name]
              ELSE ARRAY[bu.name]
            END AS budgetary_unit_names,
            array_agg(DISTINCT f.fiscal_year ORDER BY f.fiscal_year) AS fiscal_years,
            SUM(f.amount) AS total_amount,
            COUNT(DISTINCT f.id) AS item_count
          FROM dim_output o
          JOIN fact_budget_item f ON f.output_id = o.id
          JOIN dim_budgetary_unit bu ON f.budgetary_unit_id = bu.id
          LEFT JOIN dim_budgetary_unit bu_parent ON bu.parent_id = bu_parent.id
          WHERE o.name ILIKE $1
            ${buildYearCond(2)}
          GROUP BY o.id, o.name, bu.id, bu.name, bu_parent.id, bu_parent.name
          ORDER BY o.name, bu_parent.name NULLS FIRST, bu.name
          LIMIT ${limit}
          `,
          buildParams()
        ),

        // Projects — one row per (project, budgetary_unit) pair
        query(
          `
          SELECT
            p.id,
            p.name,
            CASE WHEN bu_parent.id IS NOT NULL
              THEN ARRAY[bu_parent.id, bu.id]
              ELSE ARRAY[bu.id]
            END AS budgetary_unit_ids,
            CASE WHEN bu_parent.name IS NOT NULL
              THEN ARRAY[bu_parent.name, bu.name]
              ELSE ARRAY[bu.name]
            END AS budgetary_unit_names,
            array_agg(DISTINCT f.fiscal_year ORDER BY f.fiscal_year) AS fiscal_years,
            SUM(f.amount) AS total_amount,
            COUNT(DISTINCT f.id) AS item_count
          FROM dim_project p
          JOIN fact_budget_item f ON f.project_id = p.id
          JOIN dim_budgetary_unit bu ON f.budgetary_unit_id = bu.id
          LEFT JOIN dim_budgetary_unit bu_parent ON bu.parent_id = bu_parent.id
          WHERE p.name ILIKE $1
            ${buildYearCond(2)}
          GROUP BY p.id, p.name, bu.id, bu.name, bu_parent.id, bu_parent.name
          ORDER BY p.name, bu_parent.name NULLS FIRST, bu.name
          LIMIT ${limit}
          `,
          buildParams()
        ),

        // Categories — one row per (category, budgetary_unit) pair
        query(
          `
          SELECT
            c.id,
            c.name,
            c.level,
            c.parent_id,
            CASE WHEN bu_parent.id IS NOT NULL
              THEN ARRAY[bu_parent.id, bu.id]
              ELSE ARRAY[bu.id]
            END AS budgetary_unit_ids,
            CASE WHEN bu_parent.name IS NOT NULL
              THEN ARRAY[bu_parent.name, bu.name]
              ELSE ARRAY[bu.name]
            END AS budgetary_unit_names,
            array_agg(DISTINCT f.fiscal_year ORDER BY f.fiscal_year) AS fiscal_years,
            SUM(f.amount) AS total_amount,
            COUNT(DISTINCT f.id) AS item_count
          FROM dim_category c
          JOIN fact_budget_item f ON f.category_id = c.id
          JOIN dim_budgetary_unit bu ON f.budgetary_unit_id = bu.id
          LEFT JOIN dim_budgetary_unit bu_parent ON bu.parent_id = bu_parent.id
          WHERE c.name ILIKE $1
            ${buildYearCond(2)}
          GROUP BY c.id, c.name, c.level, c.parent_id, bu.id, bu.name, bu_parent.id, bu_parent.name
          ORDER BY c.level, c.name, bu_parent.name NULLS FIRST, bu.name
          LIMIT ${limit}
          `,
          buildParams()
        ),

        // Item descriptions — one row per (item_description, budgetary_unit) pair
        query(
          `
          SELECT
            f.item_description AS id,
            f.item_description AS name,
            CASE WHEN bu_parent.id IS NOT NULL
              THEN ARRAY[bu_parent.id, bu.id]
              ELSE ARRAY[bu.id]
            END AS budgetary_unit_ids,
            CASE WHEN bu_parent.name IS NOT NULL
              THEN ARRAY[bu_parent.name, bu.name]
              ELSE ARRAY[bu.name]
            END AS budgetary_unit_names,
            array_agg(DISTINCT f.fiscal_year ORDER BY f.fiscal_year) AS fiscal_years,
            SUM(f.amount) AS total_amount,
            COUNT(DISTINCT f.id) AS item_count
          FROM fact_budget_item f
          JOIN dim_budgetary_unit bu ON f.budgetary_unit_id = bu.id
          LEFT JOIN dim_budgetary_unit bu_parent ON bu.parent_id = bu_parent.id
          WHERE f.item_description ILIKE $1
            ${buildYearCond(2)}
          GROUP BY f.item_description, bu.id, bu.name, bu_parent.id, bu_parent.name
          ORDER BY f.item_description, bu_parent.name NULLS FIRST, bu.name
          LIMIT ${limit}
          `,
          buildParams()
        ),
      ]);

      return res.json({
        query: q.trim(),
        years: years.length > 0 ? years : null,
        limit,
        groups: {
          budgetary_unit: {
            total: budgetaryUnitResult.rowCount,
            items: budgetaryUnitResult.rows,
          },
          budget_plan: {
            total: budgetPlanResult.rowCount,
            items: budgetPlanResult.rows,
          },
          output: {
            total: outputResult.rowCount,
            items: outputResult.rows,
          },
          project: {
            total: projectResult.rowCount,
            items: projectResult.rows,
          },
          category: {
            total: categoryResult.rowCount,
            items: categoryResult.rows,
          },
          item: {
            total: itemResult.rowCount,
            items: itemResult.rows,
          },
        },
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
}
