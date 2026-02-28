import 'dotenv/config';
import { query } from './src/db.js';

// Set DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/thaibudget';
}

async function testTotals() {
  // Check NULL coverage
  console.log('=== NULL Coverage Check ===');
  const coverage = await query(`
    select 
      count(*) as total_facts,
      count(budgetary_unit_id) as with_ministry,
      count(budget_plan_id) as with_budget_plan,
      count(category_id) as with_category
    from fact_budget_item 
    where fiscal_year = 2569
  `);
  console.log(coverage.rows[0]);

  // Check totals when grouping by ministry
  console.log('\n=== Ministry Grouping Total ===');
  const ministryTotal = await query(`
    select sum(f.amount) as total
    from fact_budget_item f
    join dim_budgetary_unit bu on f.budgetary_unit_id = bu.id
    join dim_ministry m on bu.ministry_id = m.id
    where f.fiscal_year = 2569
  `);
  console.log('Ministry total:', Number(ministryTotal.rows[0].total).toLocaleString());

  // Check totals when grouping by budget_plan
  console.log('\n=== Budget Plan Grouping Total ===');
  const budgetPlanTotal = await query(`
    select sum(f.amount) as total
    from fact_budget_item f
    join dim_budget_plan bp on f.budget_plan_id = bp.id
    where f.fiscal_year = 2569
  `);
  console.log('Budget Plan total:', Number(budgetPlanTotal.rows[0].total).toLocaleString());

  // Check totals when grouping by category
  console.log('\n=== Category Grouping Total ===');
  const categoryTotal = await query(`
    select sum(f.amount) as total
    from fact_budget_item f
    join dim_category_path cp_group on f.category_id = cp_group.descendant_id
    join dim_category c on cp_group.ancestor_id = c.id
    where f.fiscal_year = 2569
    and c.level = 1
  `);
  console.log('Category total:', Number(categoryTotal.rows[0].total).toLocaleString());

  // Check the actual grand total (no joins)
  console.log('\n=== Grand Total (All Facts) ===');
  const grandTotal = await query(`
    select sum(f.amount) as total
    from fact_budget_item f
    where f.fiscal_year = 2569
  `);
  console.log('Grand total:', Number(grandTotal.rows[0].total).toLocaleString());

  process.exit(0);
}

testTotals().catch(err => {
  console.error(err);
  process.exit(1);
});
