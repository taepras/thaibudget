import 'dotenv/config';
import { query } from './src/db.js';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/thaibudget';
}

async function checkCategoryPath() {
  // Check how many level-1 categories exist
  const level1Count = await query(`
    select count(*) as count
    from dim_category
    where level = 1
  `);
  console.log('Level 1 categories:', level1Count.rows[0].count);

  // Check if level-1 categories have self-referential paths
  const selfPaths = await query(`
    select count(*) as count
    from dim_category c
    join dim_category_path cp on c.id = cp.descendant_id and c.id = cp.ancestor_id
    where c.level = 1
  `);
  console.log('Level 1 categories with self-paths:', selfPaths.rows[0].count);

  // Check how many facts have level-1 categories directly assigned
  const directLevel1 = await query(`
    select count(*) as count, sum(f.amount) as total
    from fact_budget_item f
    join dim_category c on f.category_id = c.id
    where f.fiscal_year = 2569 and c.level = 1
  `);
  console.log('Facts with level-1 categories:', directLevel1.rows[0]);

  // Check facts where category is NOT in path table as descendant
  const missingFromPath = await query(`
    select count(*) as count, sum(f.amount) as total
    from fact_budget_item f
    where f.fiscal_year = 2569
    and not exists (
      select 1 from dim_category_path cp
      where cp.descendant_id = f.category_id
    )
  `);
  console.log('Facts with categories missing from path table:', missingFromPath.rows[0]);

  process.exit(0);
}

checkCategoryPath().catch(err => {
  console.error(err);
  process.exit(1);
});
