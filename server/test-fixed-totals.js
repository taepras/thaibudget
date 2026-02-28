import 'dotenv/config';
import { query } from './src/db.js';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/thaibudget';
}

async function testNewTotals() {
  console.log('=== Testing with LEFT JOINs ===\n');

  // Ministry (unchanged)
  const ministryTotal = await query(`
    select sum(f.amount) as total
    from fact_budget_item f
    join dim_budgetary_unit bu on f.budgetary_unit_id = bu.id
    join dim_ministry m on bu.ministry_id = m.id
    where f.fiscal_year = 2569
  `);
  console.log('Ministry total:', Number(ministryTotal.rows[0].total).toLocaleString());

  // Budget Plan (with LEFT JOIN)
  const budgetPlanTotal = await query(`
    select sum(f.amount) as total
    from fact_budget_item f
    left join dim_budget_plan bp on f.budget_plan_id = bp.id
    where f.fiscal_year = 2569
  `);
  console.log('Budget Plan total (LEFT JOIN):', Number(budgetPlanTotal.rows[0].total).toLocaleString());

  // Category (with LEFT JOIN)
  const categoryTotal = await query(`
    select sum(f.amount) as total
    from fact_budget_item f
    left join dim_category_path cp_group on f.category_id = cp_group.descendant_id
    left join dim_category c on cp_group.ancestor_id = c.id
    where f.fiscal_year = 2569
    and (c.level = 1 or c.level is null)
  `);
  console.log('Category total (LEFT JOIN, level 1 or NULL):', Number(categoryTotal.rows[0].total).toLocaleString());

  // Grand total
  const grandTotal = await query(`
    select sum(f.amount) as total
    from fact_budget_item f
    where f.fiscal_year = 2569
  `);
  console.log('\nGrand total:', Number(grandTotal.rows[0].total).toLocaleString());

  // Check if all match
  const ministry = Number(ministryTotal.rows[0].total);
  const budgetPlan = Number(budgetPlanTotal.rows[0].total);
  const category = Number(categoryTotal.rows[0].total);
  const grand = Number(grandTotal.rows[0].total);

  console.log('\n=== Verification ===');
  console.log('Ministry matches grand total:', ministry === grand ? '✓' : '✗');
  console.log('Budget Plan matches grand total:', budgetPlan === grand ? '✓' : '✗');
  console.log('Category matches grand total:', category === grand ? '✓' : '✗');

  process.exit(0);
}

testNewTotals().catch(err => {
  console.error(err);
  process.exit(1);
});
