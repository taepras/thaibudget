const fs = require('fs');
const csv = require('csv-parse');
const path = require('path');

// Read the CSV file
const inputFile = path.join(__dirname, '../public/data-69-with-68.csv');
const outputFile = path.join(__dirname, '../public/data-69-with-68.json');

// Create a stream to read the file
const fileContent = fs.readFileSync(inputFile, 'utf-8');

// Parse CSV with relaxed settings
csv.parse(fileContent, {
  columns: true,
  skip_empty_lines: true,
  relax_column_count: true,    // Allow variable column counts
  relax_quotes: true,          // Be more lenient with quotes
  quote: '"',                  // Specify quote character
  escape: '"',                 // Specify escape character
  on_record: (record, { lines }) => {
    // If we detect a split in the item description (containing "ซีซี"), merge the fields
    const keys = Object.keys(record);
    for (let i = 0; i < keys.length; i++) {
      if (record[keys[i]] && record[keys[i]].includes('ซีซี') && keys[i+1]) {
        // Merge this field with the next one
        record[keys[i]] = record[keys[i]] + ' ' + record[keys[i+1]];
        // Remove the next field
        delete record[keys[i+1]];
      }
    }
    
    // Clean up quotes in all fields
    Object.keys(record).forEach(key => {
      if (typeof record[key] === 'string') {
        // Remove any unmatched quotes and normalize spaces
        record[key] = record[key]
          .replace(/^["']|["']$/g, '')  // Remove quotes at start/end
          .replace(/\s+/g, ' ')         // Normalize spaces
          .trim();                      // Trim extra spaces
      }
    });
    
    return record;
  }
}, (err, records) => {
  if (err) {
    console.error('Error parsing CSV:', err);
    return;
  }

  // Create optimized structure
  const result = {
    ministries: {},        // Store unique ministries
    budgetaryUnits: {},   // Store unique budgetary units
    budgetPlans: {},      // Store unique budget plans
    outputs: {},          // Store unique outputs
    projects: {},         // Store unique projects
    categories: {},       // Store category hierarchies
    items: []            // Store individual budget items with references
  };

  let ministryId = 1;
  let unitId = 1;
  let planId = 1;
  let outputId = 1;
  let projectId = 1;
  let categoryId = 1;

  records.forEach(record => {
    // Handle Ministry
    if (!result.ministries[record.MINISTRY]) {
      result.ministries[record.MINISTRY] = ministryId++;
    }

    // Handle Budgetary Unit
    if (!result.budgetaryUnits[record.BUDGETARY_UNIT]) {
      result.budgetaryUnits[record.BUDGETARY_UNIT] = unitId++;
    }

    // Handle Budget Plan
    if (!result.budgetPlans[record.BUDGET_PLAN]) {
      result.budgetPlans[record.BUDGET_PLAN] = planId++;
    }

    // Handle Output
    if (record.OUTPUT && !result.outputs[record.OUTPUT]) {
      result.outputs[record.OUTPUT] = outputId++;
    }

    // Handle Project
    if (record.PROJECT && !result.projects[record.PROJECT]) {
      result.projects[record.PROJECT] = projectId++;
    }

    // Handle Categories
    const categoryKey = [
      record.CATEGORY_LV1,
      record.CATEGORY_LV2,
      record.CATEGORY_LV3,
      record.CATEGORY_LV4,
      record.CATEGORY_LV5,
      record.CATEGORY_LV6
    ].filter(Boolean).join('|');

    if (categoryKey && !result.categories[categoryKey]) {
      result.categories[categoryKey] = {
        id: categoryId++,
        levels: [
          record.CATEGORY_LV1,
          record.CATEGORY_LV2,
          record.CATEGORY_LV3,
          record.CATEGORY_LV4,
          record.CATEGORY_LV5,
          record.CATEGORY_LV6
        ].filter(Boolean)
      };
    }

    // Helper function to safely parse amount
    const parseAmount = (value) => {
      if (!value) return null;
      const cleaned = value.toString().replace(/,/g, '').trim();
      return cleaned ? parseFloat(cleaned) : null;
    };

    // Create budget item with references
    const item = {
      refDoc: record.REF_DOC || null,
      refPageNo: record.REF_PAGE_NO || null,
      ministryId: result.ministries[record.MINISTRY],
      unitId: result.budgetaryUnits[record.BUDGETARY_UNIT],
      planId: result.budgetPlans[record.BUDGET_PLAN],
      crossFunc: record.CROSS_FUNC === 'TRUE',
      outputId: record.OUTPUT ? result.outputs[record.OUTPUT] : null,
      projectId: record.PROJECT ? result.projects[record.PROJECT] : null,
      categoryId: categoryKey ? result.categories[categoryKey].id : null,
      description: record.ITEM_DESCRIPTION || null,
      amount: parseAmount(record.AMOUNT),
      fiscalYear: record.FISCAL_YEAR ? parseInt(record.FISCAL_YEAR) : null,
      obliged: record.OBLIGED === 'TRUE',
      amountLastYear: parseAmount(record.AMOUNT_LASTYEAR)
    };

    result.items.push(item);
  });

  // Write to JSON file
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log('Conversion completed successfully!');
  console.log(`Output saved to: ${outputFile}`);
});