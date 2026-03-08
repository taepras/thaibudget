import { query } from "../db.js";

export function registerDimensionsRoute(app) {
  app.get("/api/dimensions", async (req, res) => {
    try {
      const [budgetaryUnitsResult, categoriesResult, budgetPlansResult, outputProjectResult] = await Promise.all([
        query(`
          select bu.id, bu.name, 1 as level
          from dim_budgetary_unit bu
          where bu.level = 1
          order by bu.name
        `),
        query(`
          select c.id, c.name
          from dim_category c
          where c.level = 1
          order by c.name
        `),
        query(`
          select bp.id, bp.name
          from dim_budget_plan bp
          order by bp.name
        `),
        query(`
          select coalesce(o.id::bigint, -(p.id::bigint + 1), -1) as id,
                 coalesce(o.name, p.name, 'ไม่ระบุผลผลิต/โครงการ') as name
          from (
            select distinct f.output_id, f.project_id
            from fact_budget_item f
          ) f
          left join dim_output o on f.output_id = o.id
          left join dim_project p on f.project_id = p.id
          order by name
        `),
      ]);

      const obligedTypes = [
        { id: "false", name: "งบไม่ผูกพัน" },
        { id: "new", name: "งบผูกพัน (เริ่มต้นปีนี้)" },
        { id: "carry", name: "งบผูกพัน (จากปีก่อนๆ)" },
      ];

      return res.json({
        budgetary_unit: budgetaryUnitsResult.rows,
        budget_plan: budgetPlansResult.rows,
        output_project: outputProjectResult.rows,
        category: categoriesResult.rows,
        obliged: obligedTypes,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
}
