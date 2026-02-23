const fs = require('fs');
const csv = require('csv-parse');
const path = require('path');

// Read the CSV file
const inputFile = path.join(__dirname, '../public/data-69-with-68.csv');
const outputFile = path.join(__dirname, '../public/data-69-with-68-nested.json');

// Create a stream to read the file
const fileContent = fs.readFileSync(inputFile, 'utf-8');

// Helper function to safely parse amount
const parseAmount = (value) => {
  if (!value) return null;
  const cleaned = value.toString().replace(/,/g, '').trim();
  return cleaned ? parseFloat(cleaned) : null;
};

// Helper function to create nested structure
const createNestedStructure = (records) => {
  const root = {
    name: "Budget FY 2026",
    children: {},
    amount: 0,
    amountLastYear: 0,
    metadata: {
      ministries: new Set(),
      budgetPlans: new Set(),
      projects: new Set(),
      outputs: new Set()
    }
  };

  records.forEach(record => {
    const ministry = record.MINISTRY;
    const budgetPlan = record.BUDGET_PLAN;
    const project = record.PROJECT;
    const output = record.OUTPUT;
    const amount = parseAmount(record.AMOUNT) || 0;
    const amountLastYear = parseAmount(record.AMOUNT_LASTYEAR) || 0;

    // Track metadata
    root.metadata.ministries.add(ministry);
    root.metadata.budgetPlans.add(budgetPlan);
    if (project) root.metadata.projects.add(project);
    if (output) root.metadata.outputs.add(output);

    // Update root totals
    root.amount += amount;
    root.amountLastYear += amountLastYear;

    // Create or get ministry node
    if (!root.children[ministry]) {
      root.children[ministry] = {
        name: ministry,
        children: {},
        amount: 0,
        amountLastYear: 0
      };
    }
    root.children[ministry].amount += amount;
    root.children[ministry].amountLastYear += amountLastYear;

    // Create or get budget plan node
    if (!root.children[ministry].children[budgetPlan]) {
      root.children[ministry].children[budgetPlan] = {
        name: budgetPlan,
        children: {},
        amount: 0,
        amountLastYear: 0
      };
    }
    root.children[ministry].children[budgetPlan].amount += amount;
    root.children[ministry].children[budgetPlan].amountLastYear += amountLastYear;

    // Use project or output as the next level (prefer project if available)
    const nextLevel = project || output || 'Other';
    if (!root.children[ministry].children[budgetPlan].children[nextLevel]) {
      root.children[ministry].children[budgetPlan].children[nextLevel] = {
        name: nextLevel,
        children: {},
        amount: 0,
        amountLastYear: 0,
        type: project ? 'project' : (output ? 'output' : 'other')
      };
    }
    root.children[ministry].children[budgetPlan].children[nextLevel].amount += amount;
    root.children[ministry].children[budgetPlan].children[nextLevel].amountLastYear += amountLastYear;

    // Create category path
    const categories = [
      record.CATEGORY_LV1,
      record.CATEGORY_LV2,
      record.CATEGORY_LV3,
      record.CATEGORY_LV4,
      record.CATEGORY_LV5,
      record.CATEGORY_LV6
    ].filter(Boolean);

    let currentLevel = root.children[ministry].children[budgetPlan].children[nextLevel].children;
    let currentPath = [];

    categories.forEach((category, index) => {
      currentPath.push(category);
      const categoryKey = category;
      
      if (!currentLevel[categoryKey]) {
        currentLevel[categoryKey] = {
          name: category,
          fullPath: [...currentPath],
          children: {},
          items: [],
          amount: 0,
          amountLastYear: 0
        };
      }
      
      currentLevel[categoryKey].amount += amount;
      currentLevel[categoryKey].amountLastYear += amountLastYear;
      currentLevel = currentLevel[categoryKey].children;
    });

    // Add leaf item at the deepest category level, or at the nextLevel if no categories
    const targetLevel = categories.length > 0 
      ? root.children[ministry].children[budgetPlan].children[nextLevel].children[categories[0]]
      : root.children[ministry].children[budgetPlan].children[nextLevel];

    targetLevel.items = targetLevel.items || [];
    targetLevel.items.push({
      name: record.ITEM_DESCRIPTION,
      description: record.ITEM_DESCRIPTION,
      amount: amount,
      amountLastYear: amountLastYear,
      fiscalYear: parseInt(record.FISCAL_YEAR),
      obliged: record.OBLIGED === 'TRUE',
      refDoc: record.REF_DOC,
      refPageNo: record.REF_PAGE_NO,
      crossFunc: record.CROSS_FUNC === 'TRUE'
    });
  });

  // Convert metadata Sets to Arrays
  root.metadata = {
    ministries: Array.from(root.metadata.ministries),
    budgetPlans: Array.from(root.metadata.budgetPlans),
    projects: Array.from(root.metadata.projects),
    outputs: Array.from(root.metadata.outputs)
  };

  // Convert children objects to arrays recursively
  const convertChildrenToArray = (node) => {
    if (node.children) {
      node.children = Object.values(node.children).map(child => {
        return convertChildrenToArray(child);
      });
    }
    return node;
  };

  return convertChildrenToArray(root);
};

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

  // Create nested structure
  const result = createNestedStructure(records);

  // Write to JSON file
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log('Conversion completed successfully!');
  console.log(`Output saved to: ${outputFile}`);
});