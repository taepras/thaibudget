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
    select: `case when f.obliged is null then 'null' when f.obliged = false then 'false' when f.obliged_year_start = f.fiscal_year then 'new' else 'carry' end as id, case when f.obliged is null then 'ไม่ระบุ' when f.obliged = false then 'งบไม่ผูกพัน' when f.obliged_year_start = f.fiscal_year then 'งบผูกพัน (เริ่มต้นปีนี้)' else 'งบผูกพัน (จากปีก่อนๆ)' end as name`,
    join: "",
    groupBy: `case when f.obliged is null then 'null' when f.obliged = false then 'false' when f.obliged_year_start = f.fiscal_year then 'new' else 'carry' end, case when f.obliged is null then 'ไม่ระบุ' when f.obliged = false then 'งบไม่ผูกพัน' when f.obliged_year_start = f.fiscal_year then 'งบผูกพัน (เริ่มต้นปีนี้)' else 'งบผูกพัน (จากปีก่อนๆ)' end`,
  },
};

app.get("/api/dimensions", async (req, res) => {
  try {
    const [ministriesResult, categoriesResult] = await Promise.all([
      query(`
        select m.id, m.name
        from dim_ministry m
        order by m.name
      `),
      query(`
        select c.id, c.name
        from dim_category c
        where c.level = 1
        order by c.name
      `),
    ]);

    const obligedTypes = [
      { id: 'false', name: 'งบไม่ผูกพัน' },
      { id: 'new',   name: 'งบผูกพัน (เริ่มต้นปีนี้)' },
      { id: 'carry', name: 'งบผูกพัน (จากปีก่อนๆ)' },
    ];

    return res.json({
      ministry: ministriesResult.rows,
      category: categoriesResult.rows,
      obliged: obligedTypes,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/breakdown", async (req, res) => {
  // Accept ?year=2569 (single) or ?year=2568&year=2569 (multiple)
  const rawYears = Array.isArray(req.query.year) ? req.query.year : [req.query.year];
  const years = rawYears.map(Number).filter(Number.isInteger);
  let group = req.query.group;

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

  const collapseCategories = req.query.collapseCategories === 'true';

  const filterCategoryId = parseId(req.query.filterCategoryId);
  let filterCategoryParamIndex = null;
  let isTerminalCategory = false; // true if path ends with -1
  let categoryPathArray = []; // Full array of category IDs in the drill-down path

  // Parse filterCategoryPath as comma-separated string, or fall back to filterCategoryId
  let leafCategoryId = filterCategoryId;
  if (req.query.filterCategoryPath) {
    const pathStr = req.query.filterCategoryPath;
    categoryPathArray = pathStr.split(',').map(x => {
      const parsed = Number(x.trim());
      return Number.isInteger(parsed) ? parsed : null;
    }).filter(x => x !== null);

    if (categoryPathArray.length > 0) {
      isTerminalCategory = categoryPathArray[categoryPathArray.length - 1] === -1;
      if (isTerminalCategory) {
        categoryPathArray = categoryPathArray.slice(0, -1); // Remove the -1 marker
      }
      leafCategoryId = categoryPathArray[categoryPathArray.length - 1];
    }
  } else if (filterCategoryId !== null) {
    categoryPathArray = [filterCategoryId];
  }

  if (req.query.filterCategoryId && filterCategoryId === null) {
    return res
      .status(400)
      .json({ error: "filterCategoryId must be an integer" });
  }

  if (leafCategoryId !== null) {
    if (leafCategoryId === -1) {
      conditions.push("f.category_id is null");
    } else if (isTerminalCategory) {
      // Terminal category: filter for items directly in this category only (not descendants)
      params.push(leafCategoryId);
      conditions.push(`f.category_id = $${params.length}`);
    } else {
      // Non-terminal: filter for items that are descendants of ALL categories in the path
      // This ensures we only get items that match the full drill-down path
      for (let i = 0; i < categoryPathArray.length; i++) {
        const categoryId = categoryPathArray[i];
        const aliasName = `cp_filter_${i}`;
        joins.add(`left join dim_category_path ${aliasName} on f.category_id = ${aliasName}.descendant_id`);
        params.push(categoryId);
        conditions.push(`${aliasName}.ancestor_id = $${params.length}`);
      }
      // Set filterCategoryParamIndex to the last one for the category grouping logic
      filterCategoryParamIndex = params.length;
    }
  }

  // Handle obliged filter
  const filterObligedId = req.query.filterObligedId;
  if (filterObligedId !== undefined && filterObligedId !== null) {
    if (filterObligedId === 'null') {
      conditions.push('f.obliged is null');
    } else if (filterObligedId === 'false') {
      conditions.push('f.obliged = false');
    } else if (filterObligedId === 'new') {
      conditions.push('f.obliged = true and f.obliged_year_start = f.fiscal_year');
    } else if (filterObligedId === 'carry') {
      conditions.push('f.obliged = true and (f.obliged_year_start < f.fiscal_year or f.obliged_year_start is null)');
    }
  }

  // If terminal category marker (-1) is at end of path, show items instead of deeper categories
  // IMPORTANT: must also remove the category groupBy join that was added earlier using the
  // initial groupConfig (which was 'category'), otherwise it stays in the joins set and
  // multiplies every fact row by the number of ancestors, inflating all sums.
  if (isTerminalCategory && group === 'category') {
    group = 'item';
    // Remove the category-grouping joins that were pre-added for the 'category' groupConfig
    joins.delete(breakdownGroups.category.join);
    // Also add the item groupConfig join (empty string, but do this for correctness)
    // and switch groupConfig so the SELECT clause matches the new group
    if (breakdownGroups.item.join) joins.add(breakdownGroups.item.join);
  }

  // Resolve groupConfig after potential group switch (isTerminalCategory may change group to 'item')
  const resolvedGroupConfig = breakdownGroups[group];

  // Snapshot filter state (params/conditions/joins) before category-level conditions are added.
  // Used by the collapseCategories feature to run filter-aware child-count checks.
  // Rename the main table alias f -> f_col so these fragments work inside a subquery.
  const filterParamsSnapshot = [...params];
  const filterConditionsSnapshot = conditions.map(c => c.replace(/\bf\./g, 'f_col.'));
  const filterJoinsSnapshot = [...joins].map(j => j.replace(/\bf\./g, 'f_col.'));

  // For category grouping, default to level 1 (top-level categories) unless specified
  if (group === 'category') {
    let targetLevel = 1;

    // If filtering by a parent category, show the next level down
    if (leafCategoryId !== null) {
      const parentLevelResult = await query(
        'select level from dim_category where id = $1',
        [leafCategoryId]
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
      // Filter grouped categories to direct children of leafCategoryId.
      // We use c.parent_id rather than a closure-table join because dim_category_path only
      // stores (ancestor, leaf) pairs — intermediate nodes have no "descendant_id" entries
      // unless they were also ever a leaf category, so an INNER JOIN on cp_group_filter
      // would incorrectly drop those nodes.
      params.push(leafCategoryId);
      const leafCategoryParamIndex = params.length;

      conditions.push(
        `((c.level = $${targetLevelParamIndex} and c.parent_id = $${leafCategoryParamIndex}) or (f.category_id = $${filterCategoryParamIndex} and c.id = $${leafCategoryParamIndex}))`
      );
    } else {
      // When grouping by category without a drill-down filter, enforce that we show
      // only categories at the target level. This prevents showing deep categories
      // (e.g., 501) when we want top-level categories (e.g., 7).
      conditions.push(`c.level = $${targetLevelParamIndex}`);
    }
  }

  const sql = `
    select
      ${resolvedGroupConfig.select},
      f.fiscal_year,
      sum(f.amount) as total_amount,
      sum(f.amount) / nullif(sum(sum(f.amount)) over (partition by f.fiscal_year), 0) as pct
    from fact_budget_item f
    ${[...joins].join(" ")}
    where ${conditions.join(" and ")}
    group by ${resolvedGroupConfig.groupBy}, f.fiscal_year
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

      let processedRow = { ...row };

      // When grouping by category and filtering by a category, detect self-references
      // (rows where the category id equals the filtered leaf category) and convert to -1 entry
      // Note: processedRow.id comes from PostgreSQL as a string (bigint), so coerce to Number
      if (group === 'category' && leafCategoryId !== null && Number(processedRow.id) === leafCategoryId) {
        processedRow.id = -1;
        processedRow.name = 'ไม่ระบุประเภทเพิ่มเติม';
      }

      // Use name as the merge key so duplicate-named rows are aggregated together.
      // Fall back to id only when name is absent.
      const mergeKey = processedRow.name ?? processedRow.id;
      if (!rowMap.has(mergeKey)) {
        // Copy all group-level fields (id, name, level, ...) except year/amount
        const { fiscal_year, total_amount, pct, ...groupFields } = processedRow;
        rowMap.set(mergeKey, { ...groupFields, amounts: {}, pct: {} });
      }
      const entry = rowMap.get(mergeKey);
      entry.amounts[yr] = (entry.amounts[yr] || 0) + Number(row.total_amount);
      // pct will be re-derived on the client from totals; just accumulate here
      entry.pct[yr] = (entry.pct[yr] || 0) + Number(row.pct);
    }

    // Note: The main query already includes items directly in the filtered category
    // via the "or f.category_id = ..." condition, and we convert them to -1 entries above.

    // Category collapse: for each row, follow single-child chains (filter-aware) and merge names.
    // e.g. if งบลงทุน → ค่าครุภัณฑ์ฯ → ค่าที่ดินฯ (each has 1 child in the current filter),
    // collapse to a single row named "งบลงทุน > ค่าครุภัณฑ์ฯ > ค่าที่ดินฯ" with the deepest id.
    if (collapseCategories && group === 'category') {
      const MAX_COLLAPSE_DEPTH = 10;

      const getFilteredChildren = async (parentId) => {
        const colParams = [...filterParamsSnapshot, parentId];
        const parentParamIdx = colParams.length;
        const colSql = `
          select c_child.id, c_child.name
          from dim_category c_child
          where c_child.parent_id = $${parentParamIdx}
            and exists (
              select 1
              from fact_budget_item f_col
              ${filterJoinsSnapshot.join('\n              ')}
              join dim_category_path cp_col_self on f_col.category_id = cp_col_self.descendant_id
              where ${filterConditionsSnapshot.join(' and ')}
                and cp_col_self.ancestor_id = c_child.id
            )
        `;
        const result = await query(colSql, colParams);
        return result.rows;
      };

      // Collect changes first to avoid modifying Map while iterating
      const collapseChanges = [];
      for (const [mergeKey, row] of rowMap.entries()) {
        if (row.id === -1 || row.id === null || row.id === '-1') continue;

        let currentId = Number(row.id);
        const nameParts = [row.name];
        let depth = 0;

        while (depth < MAX_COLLAPSE_DEPTH) {
          const children = await getFilteredChildren(currentId);
          if (children.length !== 1) break;
          nameParts.push(children[0].name);
          currentId = Number(children[0].id);
          depth++;
        }

        if (nameParts.length > 1) {
          collapseChanges.push({ oldKey: mergeKey, row, newName: nameParts.join(' > '), newId: currentId });
        }
      }

      // Apply changes and update the level to the deepest category for correct isTerminal detection
      for (const { oldKey, row, newName, newId } of collapseChanges) {
        rowMap.delete(oldKey);
        row.name = newName;
        row.id = String(newId);
        row.collapsedFrom = oldKey; // optional: keep original name for debugging
        const levelResult = await query('select level from dim_category where id = $1', [newId]);
        if (levelResult.rows.length > 0) row.level = levelResult.rows[0].level;
        rowMap.set(newName, row);
      }
    }

    // For category grouping, check each category to see if it has children at the next level
    // This helps the frontend decide whether to drill into subcategories or show items directly
    if (group === 'category') {
      const categoryIds = [...rowMap.values()]
        .filter(row => row.id !== -1 && row.id !== null)
        .map(row => row.id);

      if (categoryIds.length > 0) {
        // Check for each category if it has any children in the category hierarchy
        // This is independent of the current filter - we just want to know if subcategories exist
        const childCheckSql = `
          select 
            c_check.id as category_id,
            exists (
              select 1
              from dim_category_path cp_check
              where cp_check.ancestor_id = c_check.id
                and cp_check.depth = 1
              limit 1
            ) as has_children
          from dim_category c_check
          where c_check.id = any($1)
        `;

        const childCheckResult = await query(childCheckSql, [categoryIds]);

        // Map the results to each row
        const hasChildrenMap = new Map();
        for (const row of childCheckResult.rows) {
          hasChildrenMap.set(row.category_id, row.has_children);
        }

        // Add isTerminal flag to each category row
        for (const row of rowMap.values()) {
          if (row.id !== -1 && row.id !== null) {
            row.isTerminal = !hasChildrenMap.get(row.id);
          } else if (row.id === -1) {
            // Self-reference entries are always terminal (they represent items without subcategories)
            row.isTerminal = true;
          }
        }
      }
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
