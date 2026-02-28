import 'dotenv/config';
import { query } from './src/db.js';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/thaibudget';
}

async function investigateCategories() {
  console.log('=== Category Investigation ===\n');

  // 1. How many facts have NULL category_id?
  const nullCategories = await query(`
    select count(*) as count, sum(amount) as total
    from fact_budget_item
    where fiscal_year = 2569 and category_id is null
  `);
  console.log('1. Facts with NULL category_id:');
  console.log('   Count:', nullCategories.rows[0].count);
  console.log('   Total:', Number(nullCategories.rows[0].total || 0).toLocaleString());

  // 2. How many facts have a category_id not in the path table?
  const missingPath = await query(`
    select count(*) as count, sum(f.amount) as total
    from fact_budget_item f
    where fiscal_year = 2569 
    and category_id is not null
    and not exists (
      select 1 from dim_category_path cp
      where cp.descendant_id = f.category_id
    )
  `);
  console.log('\n2. Facts with category_id NOT in path table:');
  console.log('   Count:', missingPath.rows[0].count);
  console.log('   Total:', Number(missingPath.rows[0].total || 0).toLocaleString());

  // 3. Show some examples of categories not in path table
  const examples = await query(`
    select distinct c.id, c.name, c.level, c.parent_id
    from fact_budget_item f
    join dim_category c on f.category_id = c.id
    where fiscal_year = 2569
    and not exists (
      select 1 from dim_category_path cp
      where cp.descendant_id = f.category_id
    )
    limit 10
  `);
  console.log('\n3. Example categories NOT in path table:');
  examples.rows.forEach(row => {
    console.log(`   ID ${row.id}: "${row.name}" (level ${row.level}, parent ${row.parent_id})`);
  });

  // 4. Check if these categories have NO path entries at all (not even self-referential)
  const noSelfPath = await query(`
    select count(distinct c.id) as count
    from fact_budget_item f
    join dim_category c on f.category_id = c.id
    where fiscal_year = 2569
    and not exists (
      select 1 from dim_category_path cp
      where cp.descendant_id = c.id and cp.ancestor_id = c.id
    )
  `);
  console.log('\n4. Categories without even self-referential path:');
  console.log('   Count:', noSelfPath.rows[0].count);

  // 5. Check total categories vs categories with paths
  const categoryStats = await query(`
    select 
      (select count(*) from dim_category) as total_categories,
      (select count(distinct descendant_id) from dim_category_path) as categories_with_path
  `);
  console.log('\n5. Overall category stats:');
  console.log('   Total categories:', categoryStats.rows[0].total_categories);
  console.log('   Categories with path entries:', categoryStats.rows[0].categories_with_path);

  process.exit(0);
}

investigateCategories().catch(err => {
  console.error(err);
  process.exit(1);
});
