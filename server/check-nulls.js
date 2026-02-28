import { query } from './src/db.js';

async function checkNulls() {
  const result = await query(`
    select 
      count(*) as total_facts,
      count(budgetary_unit_id) as with_ministry,
      count(budget_plan_id) as with_budget_plan,
      count(category_id) as with_category,
      count(output_id) as with_output,
      count(project_id) as with_project
    from fact_budget_item 
    where fiscal_year = 2569
  `);

  console.log('Data coverage for year 2569:');
  console.log(result.rows[0]);

  // Also check totals
  const totalsByGroup = await query(`
    select 
      'ministry' as group_type,
      sum(f.amount) as total
    from fact_budget_item f
    join dim_budgetary_unit bu on f.budgetary_unit_id = bu.id
    join dim_ministry m on bu.ministry_id = m.id
    where f.fiscal_year = 2569
    
    union all
    
    select 
      'budget_plan' as group_type,
      sum(f.amount) as total
    from fact_budget_item f
    join dim_budget_plan bp on f.budget_plan_id = bp.id
    where f.fiscal_year = 2569
    
    union all
    
    select 
      'category' as group_type,
      sum(f.amount) as total
    from fact_budget_item f
    join dim_category c on f.category_id = c.id
    where f.fiscal_year = 2569
    and c.level = 1
  `);

  console.log('\nTotals by different groupings:');
  totalsByGroup.rows.forEach(row => {
    console.log(`${row.group_type}: ${Number(row.total).toLocaleString()}`);
  });

  process.exit(0);
}

checkNulls().catch(err => {
  console.error(err);
  process.exit(1);
});
