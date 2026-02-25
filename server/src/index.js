import "dotenv/config";
import express from "express";
import cors from "cors";
import { query } from "./db.js";

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
    select: "bp.id as id, bp.name as name",
    join: "join dim_budget_plan bp on f.budget_plan_id = bp.id",
    groupBy: "bp.id, bp.name",
  },
  output: {
    select: "o.id as id, o.name as name",
    join: "join dim_output o on f.output_id = o.id",
    groupBy: "o.id, o.name",
  },
  project: {
    select: "p.id as id, p.name as name",
    join: "join dim_project p on f.project_id = p.id",
    groupBy: "p.id, p.name",
  },
  category: {
    select: "c.id as id, c.name as name, c.level as level",
    join: "join dim_category c on f.category_id = c.id",
    groupBy: "c.id, c.name, c.level",
  },
};

app.get("/api/breakdown", async (req, res) => {
  const year = Number(req.query.year);
  const group = req.query.group;

  const parseId = (value) => {
    if (value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  };

  if (!Number.isInteger(year)) {
    return res.status(400).json({ error: "year is required" });
  }

  const groupConfig = breakdownGroups[group];
  if (!groupConfig) {
    return res.status(400).json({ error: "unsupported group" });
  }

  const params = [year];
  const conditions = ["f.fiscal_year = $1"];
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
      "join dim_category_path cp on f.category_id = cp.descendant_id",
  };

  joins.add(groupConfig.join);

  const filterMinistryId = parseId(req.query.filterMinistryId);
  if (req.query.filterMinistryId && filterMinistryId === null) {
    return res.status(400).json({ error: "filterMinistryId must be an integer" });
  }
  if (filterMinistryId !== null) {
    joins.add(joinMap.ministry);
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
    joins.add(joinMap.budgetary_unit);
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
    joins.add(joinMap.budget_plan);
    params.push(filterBudgetPlanId);
    conditions.push(`bp.id = $${params.length}`);
  }

  const filterOutputId = parseId(req.query.filterOutputId);
  if (req.query.filterOutputId && filterOutputId === null) {
    return res.status(400).json({ error: "filterOutputId must be an integer" });
  }
  if (filterOutputId !== null) {
    joins.add(joinMap.output);
    params.push(filterOutputId);
    conditions.push(`o.id = $${params.length}`);
  }

  const filterProjectId = parseId(req.query.filterProjectId);
  if (req.query.filterProjectId && filterProjectId === null) {
    return res.status(400).json({ error: "filterProjectId must be an integer" });
  }
  if (filterProjectId !== null) {
    joins.add(joinMap.project);
    params.push(filterProjectId);
    conditions.push(`p.id = $${params.length}`);
  }

  const filterCategoryId = parseId(req.query.filterCategoryId);
  if (req.query.filterCategoryId && filterCategoryId === null) {
    return res
      .status(400)
      .json({ error: "filterCategoryId must be an integer" });
  }
  if (filterCategoryId !== null) {
    joins.add(joinMap.category_path);
    params.push(filterCategoryId);
    conditions.push(`cp.ancestor_id = $${params.length}`);
  }

  const sql = `
    select
      ${groupConfig.select},
      sum(f.amount) as total_amount,
      sum(f.amount) / nullif(sum(sum(f.amount)) over (), 0) as pct
    from fact_budget_item f
    ${[...joins].join(" ")}
    where ${conditions.join(" and ")}
    group by ${groupConfig.groupBy}
    order by total_amount desc
  `;

  try {
    const result = await query(sql, params);
    return res.json({
      year,
      group,
      total: result.rows.reduce((sum, row) => sum + Number(row.total_amount), 0),
      rows: result.rows,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
