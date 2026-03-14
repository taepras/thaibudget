import { query } from "../db.js";

/**
 * Build SQL JOIN and WHERE fragments from active filter params,
 * excluding the specified dimension so each dropdown isn't filtered by its own value.
 *
 * @param {object} reqQuery - Express req.query
 * @param {string} excludeDimension - Which dimension to skip ('budgetary_unit'|'budget_plan'|'output_project'|'category')
 * @param {number} paramOffset - Starting $N index (after any earlier params like year)
 * @returns {{ joinSQL: string, whereSQL: string, params: any[] }}
 */
function makeFilterFragments(reqQuery, excludeDimension, paramOffset) {
  const params = [];
  const joinParts = [];
  const whereParts = [];
  let off = paramOffset;

  if (excludeDimension !== 'budgetary_unit' && reqQuery.filterBudgetaryUnitPath) {
    const ids = String(reqQuery.filterBudgetaryUnitPath)
      .split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isInteger(n));
    ids.forEach((id, i) => {
      joinParts.push(`join dim_budgetary_unit_path bup_f${i} on f.budgetary_unit_id = bup_f${i}.descendant_id`);
      params.push(id);
      whereParts.push(`bup_f${i}.ancestor_id = $${off++}`);
    });
  }

  if (excludeDimension !== 'budget_plan' && reqQuery.filterBudgetPlanId != null && reqQuery.filterBudgetPlanId !== '') {
    const id = parseInt(reqQuery.filterBudgetPlanId, 10);
    if (Number.isInteger(id)) {
      if (id === -1) { whereParts.push('f.budget_plan_id is null'); }
      else { params.push(id); whereParts.push(`f.budget_plan_id = $${off++}`); }
    }
  }

  if (excludeDimension !== 'output_project' && reqQuery.filterOutputProjectId != null && reqQuery.filterOutputProjectId !== '') {
    const id = parseInt(reqQuery.filterOutputProjectId, 10);
    if (Number.isInteger(id)) {
      if (id === -1) { whereParts.push('f.output_id is null and f.project_id is null'); }
      else if (id < -1) { params.push(-id - 1); whereParts.push(`f.project_id = $${off++}`); }
      else { params.push(id); whereParts.push(`f.output_id = $${off++}`); }
    }
  }

  if (excludeDimension !== 'category' && reqQuery.filterCategoryPath) {
    const ids = String(reqQuery.filterCategoryPath)
      .split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isInteger(n) && n !== -1);
    ids.forEach((id, i) => {
      joinParts.push(`join dim_category_path cp_f${i} on f.category_id = cp_f${i}.descendant_id`);
      params.push(id);
      whereParts.push(`cp_f${i}.ancestor_id = $${off++}`);
    });
  }

  return {
    joinSQL: joinParts.join('\n              '),
    whereSQL: whereParts.length > 0 ? `\n              and ${whereParts.join('\n              and ')}` : '',
    params,
  };
}

export function registerDimensionsRoute(app) {
  app.get("/api/dimensions", async (req, res) => {
    const year = req.query.year ? Number(req.query.year) : null;
    const yearCond = year ? 'and f.fiscal_year = $1' : '';

    try {
      // Build filter fragments for each dimension, excluding itself to avoid circular filtering
      const buF  = makeFilterFragments(req.query, 'budgetary_unit', year ? 2 : 1);
      const catF = makeFilterFragments(req.query, 'category',       year ? 2 : 1);
      const bpF  = makeFilterFragments(req.query, 'budget_plan',    year ? 2 : 1);
      const opF  = makeFilterFragments(req.query, 'output_project', year ? 2 : 1);

      const buParams  = year ? [year, ...buF.params]  : buF.params;
      const catParams = year ? [year, ...catF.params] : catF.params;
      const bpParams  = year ? [year, ...bpF.params]  : bpF.params;
      const opParams  = year ? [year, ...opF.params]  : opF.params;

      const [budgetaryUnitsResult, categoriesResult, budgetPlansResult, outputProjectResult] = await Promise.all([
        query(`
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
              ${buF.joinSQL}
              where f.budgetary_unit_id = bu2.id
              ${yearCond}${buF.whereSQL}
            )
          where bu1.level = 1
            and exists (
              select 1 from fact_budget_item f
              join dim_budgetary_unit_path bup on f.budgetary_unit_id = bup.descendant_id
              ${buF.joinSQL}
              where bup.ancestor_id = bu1.id
              ${yearCond}${buF.whereSQL}
            )
          group by bu1.id, bu1.name
          order by bu1.name
        `, buParams),
        query(`
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
              ${catF.joinSQL}
              where cp.ancestor_id = c2.id
              ${yearCond}${catF.whereSQL}
            )
          where c1.level = 1
            and exists (
              select 1 from fact_budget_item f
              join dim_category_path cp on f.category_id = cp.descendant_id
              ${catF.joinSQL}
              where cp.ancestor_id = c1.id
              ${yearCond}${catF.whereSQL}
            )
          group by c1.id, c1.name
          order by c1.name
        `, catParams),
        query(`
          select bp.id, bp.name
          from dim_budget_plan bp
          ${bpParams.length > 0 ? `where exists (
            select 1 from fact_budget_item f
            ${bpF.joinSQL}
            where f.budget_plan_id = bp.id
            ${yearCond}${bpF.whereSQL}
          )` : ''}
          order by bp.name
        `, bpParams),
        query(`
          select coalesce(o.id::bigint, -(p.id::bigint + 1), -1) as id,
                 coalesce(o.name, p.name, 'ไม่ระบุผลผลิต/โครงการ') as name
          from (
            select distinct f.output_id, f.project_id
            from fact_budget_item f
            ${opF.joinSQL}
            ${opParams.length > 0 ? `where 1=1 ${yearCond}${opF.whereSQL}` : ''}
          ) f
          left join dim_output o on f.output_id = o.id
          left join dim_project p on f.project_id = p.id
          order by name
        `, opParams),
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
