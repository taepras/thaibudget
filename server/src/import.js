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

async function getOrCreateMinistry(client, name, cache) {
  return getOrCreateByName(client, "dim_ministry", name, cache);
}

async function getOrCreateBudgetaryUnit(client, ministryId, name, cache) {
  if (!name) {
    return null;
  }
  const key = `${ministryId || 0}::${name}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const result = await client.query(
    "insert into dim_budgetary_unit (ministry_id, name) values ($1, $2)\n" +
      "on conflict (ministry_id, name) do update set name = excluded.name\n" +
      "returning id",
    [ministryId, name]
  );
  const id = result.rows[0].id;
  cache.set(key, id);
  return id;
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

async function preloadDimensions(client, allRecords, { ministryCache, budgetaryUnitCache, budgetPlanCache, outputCache, projectCache }) {
  // 1. Ministries
  const ministryNames = [...new Set(
    allRecords.map(r => {
      const raw = normalizeText(r.MINISTRY);
      return raw ? raw.replace(/\([0-9]+\)$/, '').trim() : null;
    }).filter(Boolean)
  )];
  if (ministryNames.length) {
    const res = await client.query(
      `insert into dim_ministry (name) select unnest($1::text[])
       on conflict (name) do update set name = excluded.name returning id, name`,
      [ministryNames]
    );
    res.rows.forEach(r => ministryCache.set(r.name, r.id));
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

  // 3. Budgetary units (depends on ministry IDs being loaded first)
  const buMap = new Map();
  for (const r of allRecords) {
    const ministryRaw = normalizeText(r.MINISTRY);
    const ministryName = ministryRaw ? ministryRaw.replace(/\([0-9]+\)$/, '').trim() : null;
    const unitName = normalizeText(r.BUDGETARY_UNIT);
    if (ministryName && unitName) buMap.set(`${ministryName}::${unitName}`, { ministryName, unitName });
  }
  const buPairs = [...buMap.values()];
  if (buPairs.length) {
    const res = await client.query(
      `insert into dim_budgetary_unit (ministry_id, name)
       select m.id, u.unit_name
       from unnest($1::text[], $2::text[]) as u(ministry_name, unit_name)
       join dim_ministry m on m.name = u.ministry_name
       on conflict (ministry_id, name) do update set name = excluded.name
       returning id, name, ministry_id`,
      [buPairs.map(p => p.ministryName), buPairs.map(p => p.unitName)]
    );
    res.rows.forEach(r => budgetaryUnitCache.set(`${r.ministry_id}::${r.name}`, r.id));
  }
  console.log('Phase 2 complete');
}

async function runImport() {
  console.log(`Starting import from ${csvPath}`);
  console.log(`Reset mode: ${reset}`);

  const client = await pool.connect();
  console.log("Database connected");

  const ministryCache = new Map();
  const budgetaryUnitCache = new Map();
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

    // Add obliged span columns if not already present (idempotent migration)
    await client.query(`
      alter table fact_budget_item
        add column if not exists obliged_year_start integer,
        add column if not exists obliged_year_end integer,
        add column if not exists obliged_total_amount numeric(18,2)
    `);

    if (reset) {
      console.log("Truncating tables...");
      await client.query(
        "truncate table fact_budget_item, dim_category_path, dim_category, dim_project, dim_output, dim_budget_plan, dim_budgetary_unit, dim_ministry restart identity cascade"
      );
      console.log("Tables truncated");
      // Drop secondary indexes before bulk insert; recreate after commit
      await client.query("drop index if exists idx_fact_year");
      await client.query("drop index if exists idx_fact_budgetary_unit");
      await client.query("drop index if exists idx_fact_category");
      await client.query("drop index if exists idx_catpath_ancestor");
      await client.query("drop index if exists idx_catpath_descendant");
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
      ministryCache, budgetaryUnitCache, budgetPlanCache, outputCache, projectCache,
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
        const offset = rowIndex * 17;
        params.push(...row);
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, ` +
          `$${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, ` +
          `$${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, ` +
          `$${offset + 15}, $${offset + 16}, $${offset + 17})`;
      });

      await client.query(
        "insert into fact_budget_item (\n" +
          "item_id, ref_doc, ref_page_no, budgetary_unit_id, cross_func,\n" +
          "budget_plan_id, output_id, project_id, category_id, item_description,\n" +
          "fiscal_year, amount, obliged, debug_log,\n" +
          "obliged_year_start, obliged_year_end, obliged_total_amount\n" +
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
      const ministryId = await getOrCreateMinistry(
        client,
        ministryName,
        ministryCache
      );

      const budgetaryUnitId = await getOrCreateBudgetaryUnit(
        client,
        ministryId,
        normalizeText(record.BUDGETARY_UNIT),
        budgetaryUnitCache
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

      // Process each year's amount
      const yearAmounts = [
        { year: 2565, amount: parseAmount(record.AMOUNT_2565) },
        { year: 2566, amount: parseAmount(record.AMOUNT_2566) },
        { year: 2567, amount: parseAmount(record.AMOUNT_2567) },
        { year: 2568, amount: parseAmount(record.AMOUNT_2568) },
        { year: 2569, amount: parseAmount(record.AMOUNT_2569) },
      ];

      const rowKey = normalizeText(record.ITEM_ID) || `ROW_${rowCount}`;

      for (const { year, amount } of yearAmounts) {
        if (amount === null || amount === 0) {
          continue;
        }
        factRows.push([
          `${rowKey}_${year}`,
          normalizeText(record.REF_DOC),
          parseInteger(record.REF_PAGE_NO),
          budgetaryUnitId,
          parseBool(record["CROSS_FUNC?"]),
          budgetPlanId,
          outputId,
          projectId,
          categoryId,
          normalizeText(record.ITEM_DESCRIPTION),
          year,
          amount,
          parseBool(record["OBLIGED?"]),
          normalizeText(record.DEBUG_LOG),
          parseInteger(record.OBLIGED_YEAR_START),
          parseInteger(record.OBLIGED_YEAR_END),
          parseAmount(record.OBLIGED_TOTAL_AMOUNT),
        ]);

        insertedCount += 1;

        if (factRows.length >= FACT_BATCH_SIZE) {
          await flushFactRows();
        }
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
