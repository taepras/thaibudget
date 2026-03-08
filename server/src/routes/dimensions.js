import { query } from "../db.js";

export function registerDimensionsRoute(app) {
  app.get("/api/dimensions", async (req, res) => {
    const year = req.query.year ? Number(req.query.year) : null;

    try {
      const [budgetaryUnitsResult, categoriesResult, budgetPlansResult, outputProjectResult] = await Promise.all([
        year
          ? query(`
              select bu1.id, bu1.name,
                coalesce(
                  json_agg(json_build_object('id', bu2.id, 'name', bu2.name) order by bu2.name)
                    filter (where bu2.id is not null),
                  '[]'::json
                ) as children
              from dim_budgetary_unit bu1
              left join dim_budgetary_unit bu2
                on bu2.parent_id = bu1.id and bu2.level = 2
                and exists (
                  select 1 from fact_budget_item f
                  where f.budgetary_unit_id = bu2.id and f.fiscal_year = $1
                )
              where bu1.level = 1
                and exists (
                  select 1 from fact_budget_item f
                  join dim_budgetary_unit_path bup on f.budgetary_unit_id = bup.descendant_id
                  where bup.ancestor_id = bu1.id and f.fiscal_year = $1
                )
              group by bu1.id, bu1.name
              order by bu1.name
            `, [year])
          : query(`
              select bu1.id, bu1.name,
                coalesce(
                  json_agg(json_build_object('id', bu2.id, 'name', bu2.name) order by bu2.name)
                    filter (where bu2.id is not null),
                  '[]'::json
                ) as children
              from dim_budgetary_unit bu1
              left join dim_budgetary_unit bu2 on bu2.parent_id = bu1.id and bu2.level = 2
              where bu1.level = 1
              group by bu1.id, bu1.name
              order by bu1.name
            `),
        year
          ? query(`
              select c1.id, c1.name,
                coalesce(
                  json_agg(json_build_object('id', c2.id, 'name', c2.name) order by c2.name)
                    filter (where c2.id is not null),
                  '[]'::json
                ) as children
              from dim_category c1
              left join dim_category c2
                on c2.parent_id = c1.id and c2.level = 2
                and exists (
                  select 1 from fact_budget_item f
                  join dim_category_path cp on f.category_id = cp.descendant_id
                  where cp.ancestor_id = c2.id and f.fiscal_year = $1
                )
              where c1.level = 1
                and exists (
                  select 1 from fact_budget_item f
                  join dim_category_path cp on f.category_id = cp.descendant_id
                  where cp.ancestor_id = c1.id and f.fiscal_year = $1
                )
              group by c1.id, c1.name
              order by c1.name
            `, [year])
          : query(`
              select c1.id, c1.name,
                coalesce(
                  json_agg(json_build_object('id', c2.id, 'name', c2.name) order by c2.name)
                    filter (where c2.id is not null),
                  '[]'::json
                ) as children
              from dim_category c1
              left join dim_category c2 on c2.parent_id = c1.id and c2.level = 2
              where c1.level = 1
              group by c1.id, c1.name
              order by c1.name
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
