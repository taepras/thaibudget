export const breakdownGroups = {
  budgetary_unit: {
    select: "bu.id as id, bu.name as name, bu.level as level, bu.parent_id as parent_id",
    join: "join dim_budgetary_unit bu on f.budgetary_unit_id = bu.id",
    groupBy: "bu.id, bu.name, bu.level, bu.parent_id",
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
    select:
      "coalesce(c.id, -1) as id, coalesce(c.name, 'ไม่ระบุประเภทรายจ่าย') as name, coalesce(c.level, 0) as level",
    join: "left join dim_category_path cp_group on f.category_id = cp_group.descendant_id left join dim_category c on cp_group.ancestor_id = c.id",
    groupBy: "c.id, c.name, c.level",
    levelFilter: true,
    includeNullCategory: true,
  },
  item: {
    select: "f.item_description as id, f.item_description as name",
    join: "",
    groupBy: "f.item_description",
  },
  obliged: {
    select: `
      case 
        when f.obliged is null then 'null'
        when f.obliged = false then 'false'
        when f.obliged = true and f.obliged_data_by_source is not null then
          case 
            when f.fiscal_year = (select min((entry->>'fiscalYear')::int) from jsonb_array_elements(f.obliged_data_by_source) as entry) then 'new'
            else 'carry'
          end
        else 'false'
      end as id,
      case 
        when f.obliged is null then 'ไม่ระบุ'
        when f.obliged = false then 'งบไม่ผูกพัน'
        when f.obliged = true and f.obliged_data_by_source is not null then
          case 
            when f.fiscal_year = (select min((entry->>'fiscalYear')::int) from jsonb_array_elements(f.obliged_data_by_source) as entry) then 'งบผูกพัน (เริ่มต้นปีนี้)'
            else 'งบผูกพัน (จากปีก่อนๆ)'
          end
        else 'งบไม่ผูกพัน'
      end as name
    `,
    join: "",
    groupBy: `
      case 
        when f.obliged is null then 'null'
        when f.obliged = false then 'false'
        when f.obliged = true and f.obliged_data_by_source is not null then
          case 
            when f.fiscal_year = (select min((entry->>'fiscalYear')::int) from jsonb_array_elements(f.obliged_data_by_source) as entry) then 'new'
            else 'carry'
          end
        else 'false'
      end,
      case 
        when f.obliged is null then 'ไม่ระบุ'
        when f.obliged = false then 'งบไม่ผูกพัน'
        when f.obliged = true and f.obliged_data_by_source is not null then
          case 
            when f.fiscal_year = (select min((entry->>'fiscalYear')::int) from jsonb_array_elements(f.obliged_data_by_source) as entry) then 'งบผูกพัน (เริ่มต้นปีนี้)'
            else 'งบผูกพัน (จากปีก่อนๆ)'
          end
        else 'งบไม่ผูกพัน'
      end
    `,
  },
};
