const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

function createKey(row) {
    return [
        row.MINISTRY,
        row.BUDGETARY_UNIT,
        row.BUDGET_PLAN,
        row.CROSS_FUNC,
        row.OUTPUT,
        row.PROJECT,
        row.CATEGORY_LV1,
        row.CATEGORY_LV2,
        row.CATEGORY_LV3,
        row.CATEGORY_LV4,
        row.CATEGORY_LV5,
        row.CATEGORY_LV6,
        row.ITEM_DESCRIPTION
    ].join('||');
}

function checkDuplicates(filePath, fiscalYear) {
    return new Promise((resolve) => {
        const keyToRows = new Map();
        const rowCount = { total: 0, filtered: 0 };
        
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                rowCount.total++;
                if (row.FISCAL_YEAR === fiscalYear) {
                    rowCount.filtered++;
                    const key = createKey(row);
                    if (!keyToRows.has(key)) {
                        keyToRows.set(key, []);
                    }
                    keyToRows.get(key).push(row);
                }
            })
            .on('end', () => {
                const duplicates = Array.from(keyToRows.entries())
                    .filter(([, rows]) => rows.length > 1);
                
                resolve({ keyToRows, duplicates, rowCount });
            });
    });
}

Promise.all([
    checkDuplicates(path.join(__dirname, '../public/data-69.csv'), '2026'),
    checkDuplicates(path.join(__dirname, '../public/data-68.csv'), '2025'),
])
    .then(([data69, data68]) => {
        console.log('=== Data-69.csv (FISCAL_YEAR=2026) ===');
        console.log(`Total rows: ${data69.rowCount.total}, Filtered: ${data69.rowCount.filtered}`);
        console.log(`Unique keys: ${data69.keyToRows.size}, Duplicates: ${data69.duplicates.length}`);
        if (data69.duplicates.length > 0) {
            const dupsWithDiffAmounts = data69.duplicates.filter(([, rows]) => {
                const amounts = new Set(rows.map((r) => r.AMOUNT));
                return amounts.size > 1;
            });
            console.log(`  Duplicates with different AMOUNT: ${dupsWithDiffAmounts.length}`);
            dupsWithDiffAmounts.slice(0, 5).forEach(([key, rows]) => {
                console.log(`\n  Key: ${key.substring(0, 100)}...`);
                rows.forEach((r, i) => {
                    console.log(`    Row ${i + 1}: AMOUNT = ${r.AMOUNT}`);
                });
            });
        }

        console.log('\n=== Data-68.csv (FISCAL_YEAR=2025) ===');
        console.log(`Total rows: ${data68.rowCount.total}, Filtered: ${data68.rowCount.filtered}`);
        console.log(`Unique keys: ${data68.keyToRows.size}, Duplicates: ${data68.duplicates.length}`);
        if (data68.duplicates.length > 0) {
            const dupsWithDiffAmounts = data68.duplicates.filter(([, rows]) => {
                const amounts = new Set(rows.map((r) => r.AMOUNT));
                return amounts.size > 1;
            });
            console.log(`  Duplicates with different AMOUNT: ${dupsWithDiffAmounts.length}`);
            dupsWithDiffAmounts.slice(0, 5).forEach(([key, rows]) => {
                console.log(`\n  Key: ${key.substring(0, 100)}...`);
                rows.forEach((r, i) => {
                    console.log(`    Row ${i + 1}: AMOUNT = ${r.AMOUNT}`);
                });
            });
        }
    });
