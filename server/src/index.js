import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    const result = await query("select 1 as ok");
    res.json({ ok: true, db: result.rows[0].ok });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

const breakdownGroups = {
  ministry: {
    select: "m.id as id, m.name as name",
    join: "join dim_budgetary_unit bu on f.budgetary_unit_id = bu.id join dim_ministry m on bu.ministry_id = m.id",
    groupBy: "m.id, m.name",
  },
  budgetary_unit: {
    select: "bu.id as id, bu.name as name",
    join: "join dim_budgetary_unit bu on f.budgetary_unit_id = bu.id",
    groupBy: "bu.id, bu.name",
  },
  budget_plan: {
    select: "coalesce(bp.id, -1) as id, coalesce(bp.name, 'ไม่ระบุแผนงาน') as name",
    join: "left join dim_budget_plan bp on f.budget_plan_id = bp.id",
    groupBy: "bp.id, bp.name",
  },
  output: {
    select: "coalesce(o.id, -1) as id, coalesce(o.name, 'ไม่ระบุผลผลิต') as name",
    join: "left join dim_output o on f.output_id = o.id",
    groupBy: "o.id, o.name",
  },
  project: {
    select: "coalesce(p.id, -1) as id, coalesce(p.name, 'ไม่ระบุโครงการ') as name",
    join: "left join dim_project p on f.project_id = p.id",
    groupBy: "p.id, p.name",
  },
  category: {
    select: "coalesce(c.id, -1) as id, coalesce(c.name, 'ไม่ระบุประเภทรายจ่าย') as name, coalesce(c.level, 0) as level",
    join: "left join dim_category_path cp_group on f.category_id = cp_group.descendant_id left join dim_category c on cp_group.ancestor_id = c.id",
    groupBy: "c.id, c.name, c.level",
    levelFilter: true, // This group supports level filtering
    includeNullCategory: true, // Include facts without category path entries
  },
  item: {
    select: "f.item_description as id, f.item_description as name",
    join: "",
    groupBy: "f.item_description",
  },
  obliged: {
    select: "coalesce(f.obliged::text, 'null') as id, case when f.obliged is null then 'ไม่ระบุ' when f.obliged = true then 'งบผูกพัน' else 'งบไม่ผูกพัน' end as name",
    join: "",
    groupBy: "f.obliged",
  },
};

app.get("/api/breakdown", async (req, res) => {
  // Accept ?year=2569 (single) or ?year=2568&year=2569 (multiple)
  const rawYears = Array.isArray(req.query.year) ? req.query.year : [req.query.year];
  const years = rawYears.map(Number).filter(Number.isInteger);
  const group = req.query.group;

  const parseId = (value) => {
    if (value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  };

  if (years.length === 0) {
    return res.status(400).json({ error: "year is required" });
  }

  const groupConfig = breakdownGroups[group];
  if (!groupConfig) {
    return res.status(400).json({ error: "unsupported group" });
  }

  const params = [...years];
  const yearPlaceholders = years.map((_, i) => `$${i + 1}`).join(", ");
  const conditions = [`f.fiscal_year in (${yearPlaceholders})`];
  const joins = new Set();
  const joinMap = {
    ministry:
      "join dim_budgetary_unit bu on f.budgetary_unit_id = bu.id join dim_ministry m on bu.ministry_id = m.id",
    budgetary_unit: "join dim_budgetary_unit bu on f.budgetary_unit_id = bu.id",
    budget_plan: "join dim_budget_plan bp on f.budget_plan_id = bp.id",
    output: "join dim_output o on f.output_id = o.id",
    project: "join dim_project p on f.project_id = p.id",
    category: "join dim_category c on f.category_id = c.id",
    category_path:
      "join dim_category_path cp_filter on f.category_id = cp_filter.descendant_id",
  };

  const addJoin = (sql) => {
    if (!joins.has(sql)) {
      joins.add(sql);
    }
  };

  const ensureMinistryJoin = () => {
    if (joins.has(joinMap.ministry)) {
      return;
    }
    if (joins.has(joinMap.budgetary_unit)) {
      addJoin("join dim_ministry m on bu.ministry_id = m.id");
      return;
    }
    addJoin(joinMap.ministry);
  };

  const ensureBudgetaryUnitJoin = () => {
    if (joins.has(joinMap.budgetary_unit)) {
      return;
    }
    if (joins.has(joinMap.ministry)) {
      return;
    }
    addJoin(joinMap.budgetary_unit);
  };

  addJoin(groupConfig.join);

  const filterMinistryId = parseId(req.query.filterMinistryId);
  if (req.query.filterMinistryId && filterMinistryId === null) {
    return res.status(400).json({ error: "filterMinistryId must be an integer" });
  }
  if (filterMinistryId !== null) {
    ensureMinistryJoin();
    params.push(filterMinistryId);
    conditions.push(`m.id = $${params.length}`);
  }

  const filterBudgetaryUnitId = parseId(req.query.filterBudgetaryUnitId);
  if (req.query.filterBudgetaryUnitId && filterBudgetaryUnitId === null) {
    return res
      .status(400)
      .json({ error: "filterBudgetaryUnitId must be an integer" });
  }
  if (filterBudgetaryUnitId !== null) {
    ensureBudgetaryUnitJoin();
    params.push(filterBudgetaryUnitId);
    conditions.push(`bu.id = $${params.length}`);
  }

  const filterBudgetPlanId = parseId(req.query.filterBudgetPlanId);
  if (req.query.filterBudgetPlanId && filterBudgetPlanId === null) {
    return res
      .status(400)
      .json({ error: "filterBudgetPlanId must be an integer" });
  }
  if (filterBudgetPlanId !== null) {
    if (filterBudgetPlanId === -1) {
      conditions.push("f.budget_plan_id is null");
    } else {
      joins.add(joinMap.budget_plan);
      params.push(filterBudgetPlanId);
      conditions.push(`bp.id = $${params.length}`);
    }
  }

  const filterOutputId = parseId(req.query.filterOutputId);
  if (req.query.filterOutputId && filterOutputId === null) {
    return res.status(400).json({ error: "filterOutputId must be an integer" });
  }
  if (filterOutputId !== null) {
    if (filterOutputId === -1) {
      conditions.push("f.output_id is null");
    } else {
      joins.add(joinMap.output);
      params.push(filterOutputId);
      conditions.push(`o.id = $${params.length}`);
    }
  }

  const filterProjectId = parseId(req.query.filterProjectId);
  if (req.query.filterProjectId && filterProjectId === null) {
    return res.status(400).json({ error: "filterProjectId must be an integer" });
  }
  if (filterProjectId !== null) {
    if (filterProjectId === -1) {
      conditions.push("f.project_id is null");
    } else {
      joins.add(joinMap.project);
      params.push(filterProjectId);
      conditions.push(`p.id = $${params.length}`);
    }
  }

  const filterCategoryId = parseId(req.query.filterCategoryId);
  let filterCategoryParamIndex = null;
  if (req.query.filterCategoryId && filterCategoryId === null) {
    return res
      .status(400)
      .json({ error: "filterCategoryId must be an integer" });
  }
  if (filterCategoryId !== null) {
    if (filterCategoryId === -1) {
      conditions.push("f.category_id is null");
    } else {
      // Add the filter join (separate from grouping join for category)
      joins.add(joinMap.category_path);
      params.push(filterCategoryId);
      filterCategoryParamIndex = params.length;
      conditions.push(`cp_filter.ancestor_id = $${params.length}`);
    }
  }

  // Handle obliged filter (can be 'true', 'false', or 'null')
  const filterObligedId = req.query.filterObligedId;
  if (filterObligedId !== undefined && filterObligedId !== null) {
    if (filterObligedId === 'null') {
      conditions.push('f.obliged is null');
    } else if (filterObligedId === 'true') {
      conditions.push('f.obliged = true');
    } else if (filterObligedId === 'false') {
      conditions.push('f.obliged = false');
    }
  }

  // For category grouping, default to level 1 (top-level categories) unless specified
  if (group === 'category') {
    let targetLevel = 1;

    // If filtering by a parent category, show the next level down
    if (filterCategoryId !== null) {
      const parentLevelResult = await query(
        'select level from dim_category where id = $1',
        [filterCategoryId]
      );
      if (parentLevelResult.rows.length > 0) {
        targetLevel = parentLevelResult.rows[0].level + 1;
      }
    }

    // Allow manual override via categoryLevel parameter
    if (req.query.categoryLevel) {
      const manualLevel = parseInt(req.query.categoryLevel, 10);
      if (Number.isInteger(manualLevel) && manualLevel > 0) {
        targetLevel = manualLevel;
      }
    }

    params.push(targetLevel);
    const targetLevelParamIndex = params.length;

    // When drilling into a parent category, include rows posted directly on that parent
    // (i.e. no deeper subcategory) so child breakdown totals stay consistent.
    if (filterCategoryParamIndex !== null) {
      conditions.push(
        `(c.level = $${targetLevelParamIndex} or f.category_id = $${filterCategoryParamIndex})`
      );
    } else {
      conditions.push(`(c.level = $${targetLevelParamIndex} or c.level is null)`);
    }
  }

  const sql = `
    select
      ${groupConfig.select},
      f.fiscal_year,
      sum(f.amount) as total_amount,
      sum(f.amount) / nullif(sum(sum(f.amount)) over (partition by f.fiscal_year), 0) as pct
    from fact_budget_item f
    ${[...joins].join(" ")}
    where ${conditions.join(" and ")}
    group by ${groupConfig.groupBy}, f.fiscal_year
    order by f.fiscal_year, total_amount desc
  `;

  try {
    const result = await query(sql, params);

    // Pivot flat (group, fiscal_year, amount) rows into { id, name, amounts: { year: amount } }
    // Key by name (not id) so that rows sharing the same display name (e.g. multiple
    // "ไม่ระบุ" categories with different ids) are merged into a single entry.
    const rowMap = new Map();
    const totals = {};
    for (const row of result.rows) {
      const yr = String(row.fiscal_year);
      totals[yr] = (totals[yr] || 0) + Number(row.total_amount);

      // Use name as the merge key so duplicate-named rows are aggregated together.
      // Fall back to id only when name is absent.
      const mergeKey = row.name ?? row.id;
      if (!rowMap.has(mergeKey)) {
        // Copy all group-level fields (id, name, level, ...) except year/amount
        const { fiscal_year, total_amount, pct, ...groupFields } = row;
        rowMap.set(mergeKey, { ...groupFields, amounts: {}, pct: {} });
      }
      const entry = rowMap.get(mergeKey);
      entry.amounts[yr] = (entry.amounts[yr] || 0) + Number(row.total_amount);
      // pct will be re-derived on the client from totals; just accumulate here
      entry.pct[yr] = (entry.pct[yr] || 0) + Number(row.pct);
    }

    // Determine if this is a leaf level (no further drill-down possible)
    // Item is the leaf level - representing individual budget line items
    const isLeafLevel = group === 'item';

    return res.json({
      years,
      group,
      totals,
      rows: [...rowMap.values()],
      isLeafLevel,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Serve static files from React build directory
const buildPath = path.join(__dirname, "../../build");
console.log("Serving static files from:", buildPath);
app.use(express.static(buildPath));

// Fallback: serve index.html for client-side routing
app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
