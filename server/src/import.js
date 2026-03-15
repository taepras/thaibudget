import "dotenv/config";
import fs from "fs";
import path from "path";
import pg from "pg";
import { parse } from "csv-parse";

const { Pool } = pg;

const DEFAULT_CSV_PATH = path.resolve(
  process.cwd(),
  "..",
  "public",
  "data-all-years.csv"
);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[index + 1];
}

const csvPath = getArgValue("--file") || DEFAULT_CSV_PATH;
const reset = process.argv.includes("--reset");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

const FACT_BATCH_SIZE = 2000;

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseAmount(value) {
  const cleaned = normalizeText(value);
  if (!cleaned) {
    return null;
  }
  const numberValue = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseBool(value) {
  const cleaned = normalizeText(value);
  if (!cleaned) {
    return null;
  }
  const lowered = cleaned.toLowerCase();
  if (lowered === "true") return true;
  if (lowered === "false") return false;
  return null;
}

function parseInteger(value) {
  const cleaned = normalizeText(value);
  if (!cleaned) {
    return null;
  }
  const numberValue = Number(cleaned);
  return Number.isInteger(numberValue) ? numberValue : null;
}

async function getOrCreateByName(client, tableName, name, cache) {
  if (!name) {
    return null;
  }
  const cached = cache.get(name);
  if (cached) {
    return cached;
  }
  const result = await client.query(
    `insert into ${tableName} (name) values ($1)
     on conflict (name) do update set name = excluded.name
     returning id`,
    [name]
  );
  const id = result.rows[0].id;
  cache.set(name, id);
  return id;
}

async function getOrCreateBudgetaryUnit(client, ministryName, unitName, cache, pathCache) {
  // If only ministry name provided, create/get level 1 (ministry)
  // If both provided, create/get level 2 (budgetary unit) with ministry as parent

  if (!ministryName) {
    return null;
  }

  // Level 1: Ministry
  const ministryKey = `1::${ministryName}`;
  let ministryId = cache.get(ministryKey);

  if (!ministryId) {
    const result = await client.query(
      `insert into dim_budgetary_unit (name, parent_id, level)
       values ($1, null, 1)
       on conflict (name, parent_id, level) do update set name = excluded.name
       returning id`,
      [ministryName]
    );
    ministryId = result.rows[0].id;
    cache.set(ministryKey, ministryId);

    // Add self-reference in path table
    const pathKey = `${ministryId}::${ministryId}`;
    if (!pathCache.has(pathKey)) {
      await client.query(
        'insert into dim_budgetary_unit_path (ancestor_id, descendant_id, depth) values ($1, $2, 0) on conflict do nothing',
        [ministryId, ministryId]
      );
      pathCache.add(pathKey);
    }
  }

  // If no unit name, OR the unit name is identical to the ministry (e.g. งบกลาง),
  // treat the ministry itself as the terminal unit — no level-2 row needed.
  if (!unitName || unitName === ministryName) {
    return ministryId;
  }

  // Level 2: Budgetary Unit
  const unitKey = `${ministryId}::2::${unitName}`;
  let unitId = cache.get(unitKey);

  if (!unitId) {
    const result = await client.query(
      `insert into dim_budgetary_unit (name, parent_id, level)
       values ($1, $2, 2)
       on conflict (name, parent_id, level) do update set name = excluded.name
       returning id`,
      [unitName, ministryId]
    );
    unitId = result.rows[0].id;
    cache.set(unitKey, unitId);

    // Add self-reference
    const selfPathKey = `${unitId}::${unitId}`;
    if (!pathCache.has(selfPathKey)) {
      await client.query(
        'insert into dim_budgetary_unit_path (ancestor_id, descendant_id, depth) values ($1, $2, 0) on conflict do nothing',
        [unitId, unitId]
      );
      pathCache.add(selfPathKey);
    }

    // Add parent-child relationship
    const parentPathKey = `${ministryId}::${unitId}`;
    if (!pathCache.has(parentPathKey)) {
      await client.query(
        'insert into dim_budgetary_unit_path (ancestor_id, descendant_id, depth) values ($1, $2, 1) on conflict do nothing',
        [ministryId, unitId]
      );
      pathCache.add(parentPathKey);
    }
  }

  return unitId;
}

async function getOrCreateCategory(client, categoryNames, cache, pathCache) {
  let parentId = null;
  let level = 1;
  const nodeIds = [];

  for (const name of categoryNames) {
    const normalized = normalizeText(name);
    if (!normalized) {
      break;
    }
    const key = `${level}|${parentId || 0}|${normalized}`;
    let id = cache.get(key);
    if (!id) {
      const result = await client.query(
        "insert into dim_category (name, parent_id, level) values ($1, $2, $3)\n" +
          "on conflict (name, parent_id, level) do update set name = excluded.name\n" +
          "returning id",
        [normalized, parentId, level]
      );
      id = result.rows[0].id;
      cache.set(key, id);
    }
    nodeIds.push(id);
    parentId = id;
    level += 1;
  }

  if (nodeIds.length === 0) {
    return null;
  }

  const descendantId = nodeIds[nodeIds.length - 1];

  // Only insert paths once per unique leaf node
  if (!pathCache.has(descendantId)) {
    pathCache.add(descendantId);
    const values = [];
    const params = [];
    let paramIndex = 1;

    for (let i = 0; i < nodeIds.length; i += 1) {
      values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      params.push(nodeIds[i], descendantId, nodeIds.length - 1 - i);
    }

    await client.query(
      `insert into dim_category_path (ancestor_id, descendant_id, depth)
       values ${values.join(", ")}
       on conflict do nothing`,
      params
    );
  }

  return descendantId;
}

async function preloadDimensions(client, allRecords, { budgetaryUnitCache, budgetaryUnitPathCache, budgetPlanCache, outputCache, projectCache }) {
  // 1. Budgetary units (hierarchical: ministries at level 1, units at level 2)
  // First collect all unique ministries and budgetary units
  const ministryNames = new Set();
  const buPairs = new Map();

  for (const r of allRecords) {
    const ministryRaw = normalizeText(r.MINISTRY);
    const ministryName = ministryRaw ? ministryRaw.replace(/\([0-9]+\)$/, '').trim() : null;
    const unitName = normalizeText(r.BUDGETARY_UNIT);

    if (ministryName) {
      ministryNames.add(ministryName);
      // Skip level-2 when unit name equals ministry name (e.g. งบกลาง — one-tier)
      if (unitName && unitName !== ministryName) {
        buPairs.set(`${ministryName}::${unitName}`, { ministryName, unitName });
      }
    }
  }

  // Insert ministries (level 1) in bulk
  if (ministryNames.size > 0) {
    const res = await client.query(
      `insert into dim_budgetary_unit (name, parent_id, level)
       select unnest($1::text[]), null, 1
       on conflict (name, parent_id, level) do update set name = excluded.name
       returning id, name`,
      [[...ministryNames]]
    );
    res.rows.forEach(r => {
      budgetaryUnitCache.set(`1::${r.name}`, r.id);
      // Add self-reference paths
      budgetaryUnitPathCache.add(`${r.id}::${r.id}`);
    });

    // Bulk insert self-reference paths for ministries
    const ministryIds = res.rows.map(r => r.id);
    if (ministryIds.length > 0) {
      await client.query(
        `insert into dim_budgetary_unit_path (ancestor_id, descendant_id, depth)
         select id, id, 0 from unnest($1::bigint[]) as id
         on conflict do nothing`,
        [ministryIds]
      );
    }
  }

  // Insert budgetary units (level 2) in bulk
  if (buPairs.size > 0) {
    const pairs = [...buPairs.values()];
    const res = await client.query(
      `insert into dim_budgetary_unit (name, parent_id, level)
       select u.unit_name, bu_parent.id, 2
       from unnest($1::text[], $2::text[]) as u(ministry_name, unit_name)
       join dim_budgetary_unit bu_parent on bu_parent.name = u.ministry_name and bu_parent.level = 1
       on conflict (name, parent_id, level) do update set name = excluded.name
       returning id, name, parent_id`,
      [pairs.map(p => p.ministryName), pairs.map(p => p.unitName)]
    );

    // Cache and build path table
    const pathInserts = [];
    res.rows.forEach(r => {
      budgetaryUnitCache.set(`${r.parent_id}::2::${r.name}`, r.id);
      // Self-reference
      if (!budgetaryUnitPathCache.has(`${r.id}::${r.id}`)) {
        pathInserts.push([r.id, r.id, 0]);
        budgetaryUnitPathCache.add(`${r.id}::${r.id}`);
      }
      // Parent-child relationship
      if (!budgetaryUnitPathCache.has(`${r.parent_id}::${r.id}`)) {
        pathInserts.push([r.parent_id, r.id, 1]);
        budgetaryUnitPathCache.add(`${r.parent_id}::${r.id}`);
      }
    });

    if (pathInserts.length > 0) {
      await client.query(
        `insert into dim_budgetary_unit_path (ancestor_id, descendant_id, depth)
         select * from unnest($1::bigint[], $2::bigint[], $3::smallint[])
         on conflict do nothing`,
        [
          pathInserts.map(p => p[0]),
          pathInserts.map(p => p[1]),
          pathInserts.map(p => p[2])
        ]
      );
    }
  }

  // 2. Budget plans, outputs, projects (simple name tables)
  const simplePreloads = [
    { names: [...new Set(allRecords.map(r => normalizeText(r.BUDGET_PLAN)).filter(Boolean))], cache: budgetPlanCache, table: 'dim_budget_plan', label: 'budget plans' },
    { names: [...new Set(allRecords.map(r => normalizeText(r.OUTPUT)).filter(Boolean))], cache: outputCache, table: 'dim_output', label: 'outputs' },
    { names: [...new Set(allRecords.map(r => normalizeText(r.PROJECT)).filter(Boolean))], cache: projectCache, table: 'dim_project', label: 'projects' },
  ];
  for (const [i, { names, cache, table, label }] of simplePreloads.entries()) {
    if (names.length) {
      const res = await client.query(
        `insert into ${table} (name) select unnest($1::text[])
         on conflict (name) do update set name = excluded.name returning id, name`,
        [names]
      );
      res.rows.forEach(r => cache.set(r.name, r.id));
    }
  }

  console.log('Phase 2 complete');
}

async function runImport() {
  console.log(`Starting import from ${csvPath}`);
  console.log(`Reset mode: ${reset}`);

  const client = await pool.connect();
  console.log("Database connected");

  const budgetaryUnitCache = new Map();
  const budgetaryUnitPathCache = new Set();
  const budgetPlanCache = new Map();
  const outputCache = new Map();
  const projectCache = new Map();
  const categoryCache = new Map();
  const categoryPathCache = new Set();

  try {
    await client.query("begin");
    await client.query("set local synchronous_commit = off");
    console.log("Transaction started");

    // Drop legacy unique constraint on item_id if it still exists from old schema
    await client.query("alter table fact_budget_item drop constraint if exists fact_budget_item_item_id_key");

    // Add obliged data column if not already present (idempotent migration)
    await client.query(`
      alter table fact_budget_item
        add column if not exists obliged_data_by_source jsonb
    `);

    if (reset) {
      console.log("Truncating tables...");
      await client.query(
        "truncate table fact_budget_item, dim_category_path, dim_category, dim_project, dim_output, dim_budget_plan, dim_budgetary_unit_path, dim_budgetary_unit restart identity cascade"
      );
      console.log("Tables truncated");
      // Drop secondary indexes before bulk insert; recreate after commit
      await client.query("drop index if exists idx_fact_year");
      await client.query("drop index if exists idx_fact_budgetary_unit");
      await client.query("drop index if exists idx_fact_category");
      await client.query("drop index if exists idx_catpath_ancestor");
      await client.query("drop index if exists idx_catpath_descendant");
      await client.query("drop index if exists idx_bupath_ancestor");
      await client.query("drop index if exists idx_bupath_descendant");
      // Performance indexes (add_performance_indexes.sql)
      await client.query("drop index if exists idx_fact_year_bu");
      await client.query("drop index if exists idx_fact_year_category");
      await client.query("drop index if exists idx_fact_year_budget_plan");
      await client.query("drop index if exists idx_fact_year_output");
      await client.query("drop index if exists idx_fact_year_project");
      await client.query("drop index if exists idx_bupath_desc_anc");
      await client.query("drop index if exists idx_catpath_desc_anc");
      await client.query("drop index if exists idx_bu_level");
      await client.query("drop index if exists idx_cat_level");
      await client.query("drop index if exists idx_cat_parent_id");
      console.log("Indexes dropped for fast bulk insert");
    }

    // ── Phase 1: buffer all CSV records in memory ──────────────────────────
    console.log("Phase 1: reading CSV into memory...");
    const allRecords = await new Promise((resolve, reject) => {
      const records = [];
      let headers = null;
      fs.createReadStream(csvPath)
        .on('error', reject)
        .pipe(parse({
          columns: false,
          relax_quotes: true,
          relax_column_count: true,
          trim: true,
          skip_empty_lines: true,
        }))
        .on('error', reject)
        .on('data', (row) => {
          if (!headers) {
            headers = row.map(h => String(h || '').trim());
            return;
          }
          let columns = row;
          if (columns.length < headers.length) {
            columns = columns.concat(new Array(headers.length - columns.length).fill(''));
          }
          if (columns.length > headers.length) {
            columns[headers.length - 1] = columns.slice(headers.length - 1).join(',');
            columns = columns.slice(0, headers.length);
          }
          const record = {};
          for (let i = 0; i < headers.length; i += 1) {
            record[headers[i]] = columns[i];
          }
          records.push(record);
        })
        .on('end', () => resolve(records));
    });
    console.log(`Phase 1 complete: ${allRecords.length} CSV rows buffered`);

    // ── Phase 2: bulk-upsert all dimension tables ──────────────────────────
    console.log("Phase 2: pre-loading dimensions...");
    await preloadDimensions(client, allRecords, {
      budgetaryUnitCache, budgetaryUnitPathCache, budgetPlanCache, outputCache, projectCache,
    });

    // ── Phase 3: insert fact rows using pre-loaded caches ─────────────────
    console.log("Phase 3: inserting fact rows...");
    let rowCount = 0;
    let insertedCount = 0;
    const factRows = [];

    const flushFactRows = async () => {
      if (factRows.length === 0) {
        return;
      }
      const params = [];
      const values = factRows.map((row, rowIndex) => {
        const offset = rowIndex * 15;
        params.push(...row);
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, ` +
          `$${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, ` +
          `$${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15})`;
      });

      await client.query(
        "insert into fact_budget_item (\n" +
          "item_id, ref_doc, ref_page_no, budgetary_unit_id, cross_func,\n" +
          "budget_plan_id, output_id, project_id, category_id, item_description,\n" +
          "fiscal_year, amount, obliged, debug_log, obliged_data_by_source\n" +
          ") values " +
          values.join(", "),
        params
      );

      factRows.length = 0;
    };

    for (const record of allRecords) {
      rowCount += 1;

      const ministryNameRaw = normalizeText(record.MINISTRY);
      const ministryName = ministryNameRaw
        ? ministryNameRaw.replace(/\([0-9]+\)$/, '').trim()
        : null;
      const unitName = normalizeText(record.BUDGETARY_UNIT);

      const budgetaryUnitId = await getOrCreateBudgetaryUnit(
        client,
        ministryName,
        unitName,
        budgetaryUnitCache,
        budgetaryUnitPathCache
      );

      const budgetPlanId = await getOrCreateByName(
        client,
        "dim_budget_plan",
        normalizeText(record.BUDGET_PLAN),
        budgetPlanCache
      );

      const outputId = await getOrCreateByName(
        client,
        "dim_output",
        normalizeText(record.OUTPUT),
        outputCache
      );

      const projectId = await getOrCreateByName(
        client,
        "dim_project",
        normalizeText(record.PROJECT),
        projectCache
      );

      const categoryId = await getOrCreateCategory(
        client,
        [
          record.CATEGORY_LV1,
          record.CATEGORY_LV2,
          record.CATEGORY_LV3,
          record.CATEGORY_LV4,
          record.CATEGORY_LV5,
          record.CATEGORY_LV6,
        ],
        categoryCache,
        categoryPathCache
      );

      // Parse amount and fiscal year from this row (already decompressed format)
      const amount = parseAmount(record.AMOUNT);
      const fiscalYear = parseInteger(record.FISCAL_YEAR);

      // Skip rows with no amount or invalid year
      if (amount === null || amount === 0 || fiscalYear === null) {
        continue;
      }

      const rowKey = normalizeText(record.ITEM_ID) || `ROW_${rowCount}`;

      // Parse obliged data JSON
      let obligedDataJson = null;
      if (record.OBLIGED_DATA_JSON) {
        try {
          obligedDataJson = JSON.parse(record.OBLIGED_DATA_JSON);
        } catch (e) {
          console.warn(`Failed to parse OBLIGED_DATA_JSON for row ${rowCount}:`, e.message);
          obligedDataJson = null;
        }
      }

      // Insert one fact row per CSV row (no looping through years)
      factRows.push([
        `${rowKey}_${fiscalYear}`,
        normalizeText(record.REF_DOC),
        parseInteger(record.REF_PAGE_NO),
        budgetaryUnitId,
        parseBool(record["CROSS_FUNC?"]),
        budgetPlanId,
        outputId,
        projectId,
        categoryId,
        normalizeText(record.ITEM_DESCRIPTION),
        fiscalYear,
        amount,
        parseBool(record["OBLIGED?"]),
        normalizeText(record.DEBUG_LOG),
        obligedDataJson !== null ? JSON.stringify(obligedDataJson) : null,
      ]);

      insertedCount += 1;

      if (factRows.length >= FACT_BATCH_SIZE) {
        await flushFactRows();
      }

      if (rowCount % 5000 === 0) {
        console.log(`Processed ${rowCount} CSV rows → ${insertedCount} fact rows inserted...`);
      }
    }

    await flushFactRows();

    await client.query("commit");
    console.log(`Import complete. CSV rows: ${rowCount}, Fact rows inserted: ${insertedCount}`);

    if (reset) {
      console.log("Recreating indexes...");
      await client.query("create index idx_fact_year on fact_budget_item (fiscal_year)");
      await client.query("create index idx_fact_budgetary_unit on fact_budget_item (budgetary_unit_id)");
      await client.query("create index idx_fact_category on fact_budget_item (category_id)");
      await client.query("create index idx_catpath_ancestor on dim_category_path (ancestor_id)");
      await client.query("create index idx_catpath_descendant on dim_category_path (descendant_id)");
      await client.query("create index idx_bupath_ancestor on dim_budgetary_unit_path (ancestor_id)");
      await client.query("create index idx_bupath_descendant on dim_budgetary_unit_path (descendant_id)");
      // Performance indexes (add_performance_indexes.sql)
      await client.query("create index idx_fact_year_bu on fact_budget_item (fiscal_year, budgetary_unit_id)");
      await client.query("create index idx_fact_year_category on fact_budget_item (fiscal_year, category_id)");
      await client.query("create index idx_fact_year_budget_plan on fact_budget_item (fiscal_year, budget_plan_id)");
      await client.query("create index idx_fact_year_output on fact_budget_item (fiscal_year, output_id)");
      await client.query("create index idx_fact_year_project on fact_budget_item (fiscal_year, project_id)");
      await client.query("create index idx_bupath_desc_anc on dim_budgetary_unit_path (descendant_id, ancestor_id)");
      await client.query("create index idx_catpath_desc_anc on dim_category_path (descendant_id, ancestor_id)");
      await client.query("create index idx_bu_level on dim_budgetary_unit (level)");
      await client.query("create index idx_cat_level on dim_category (level)");
      await client.query("create index idx_cat_parent_id on dim_category (parent_id)");
      console.log("Indexes recreated");
    }
  } catch (error) {
    await client.query("rollback");
    console.error("Import failed:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    console.log("Database connection released");
    process.exit(process.exitCode || 0);
  }
}

runImport();
