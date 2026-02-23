const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
// Create maps to store data from each budget year
const data68Map = new Map();
const data69Map = new Map();
let headers68 = [];
let headers69 = [];

// Helper function to create a unique key from a row
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

function readCsvIntoMap(filePath, targetMap, setHeaders, fiscalYearFilter) {
    return new Promise((resolve, reject) => {
        let seenFirstRow = false;
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                if (!seenFirstRow) {
                    setHeaders(Object.keys(row));
                    seenFirstRow = true;
                }
                if (fiscalYearFilter && row.FISCAL_YEAR !== fiscalYearFilter) {
                    return;
                }
                const key = createKey(row);
                const amount = row.AMOUNT ? row.AMOUNT.replace(/,/g, '') : '';
                targetMap.set(key, { row, amount });
            })
            .on('end', resolve)
            .on('error', reject);
    });
}

function buildHeaders() {
    const headerSet = new Set(headers69.filter((h) => h !== 'AMOUNT' && h !== 'AMOUNT_LASTYEAR'));
    headers68.forEach((h) => {
        if (h !== 'AMOUNT' && h !== 'AMOUNT_LASTYEAR') {
            headerSet.add(h);
        }
    });
    const baseHeaders = Array.from(headerSet);
    baseHeaders.push('AMOUNT_69', 'AMOUNT_68', 'ROW_SOURCE');
    return baseHeaders;
}

function buildRowValues(row, headers) {
    return headers.map((h) => (row && row[h] !== undefined ? row[h] : ''));
}

function writeOuterJoin() {
    const outputFile = path.join(__dirname, '../public/data-69-with-68.csv');
    const writeStream = fs.createWriteStream(outputFile);
    const headers = buildHeaders();
    writeStream.write(`${headers.join(',')}\n`);

    const allKeys = new Set([...data69Map.keys(), ...data68Map.keys()]);
    allKeys.forEach((key) => {
        const row69 = data69Map.get(key);
        const row68 = data68Map.get(key);
        const baseRow = row69 ? row69.row : row68.row;
        const values = buildRowValues(baseRow, headers);
        const amount69Index = headers.indexOf('AMOUNT_69');
        const amount68Index = headers.indexOf('AMOUNT_68');
        const rowSourceIndex = headers.indexOf('ROW_SOURCE');

        if (amount69Index !== -1) {
            values[amount69Index] = row69 ? row69.amount : '';
        }
        if (amount68Index !== -1) {
            values[amount68Index] = row68 ? row68.amount : '';
        }
        if (rowSourceIndex !== -1) {
            values[rowSourceIndex] = row69 && row68 ? 'both' : (row69 ? '69-only' : '68-only');
        }

        writeStream.write(`${values.join(',')}\n`);
    });

    writeStream.end(() => {
        console.log('Processing complete! Output saved to data-69-with-68.csv');
        console.log(`Wrote ${allKeys.size} rows (outer join of 2568 and 2569)`);
    });
}

Promise.all([
    readCsvIntoMap(path.join(__dirname, '../public/data-68.csv'), data68Map, (h) => { headers68 = h; }, '2025'),
    readCsvIntoMap(path.join(__dirname, '../public/data-69.csv'), data69Map, (h) => { headers69 = h; }, '2026'),
])
    .then(() => {
        console.log('Finished reading data-68.csv and data-69.csv');
        console.log(`Loaded ${data68Map.size} entries from 2568 budget`);
        console.log(`Loaded ${data69Map.size} entries from 2569 budget`);
        writeOuterJoin();
    })
    .catch((err) => {
        console.error('Error processing files:', err);
        process.exitCode = 1;
    });