const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

/**
 * Outer join script for merging budget data from multiple fiscal years (2565-2569 BE)
 * Years 2565-2567 are in Thai Buddhist Era, 2568-2569 correspond to 2025-2026 CE
 *
 * Note: "อปท" (acronym) and "องค์กรปกครองส่วนท้องถิ่น" (full name for local administrative organization)
 * refer to the same entity and are normalized to the same canonical value during the merge.
 */

// Normalize ministry names to canonical form
function normalizeMinistry(ministry) {
    const ministryNormalizedNameMap = {
        'รายจ่ายเพื่อชดใช้เงินคงคลัง': 'งบประมาณรายจ่ายเพื่อชดใช้เงินคงคลัง',
        'ส่วนราชการไม่สังกัดสำนักนายกรัฐมนตรีฯ': 'ส่วนราชการไม่สังกัดสำนักนายกรัฐมนตรี กระทรวง หรือทบวง และหน่วยงานภายใต้การควบคุมดูแลของนายกรัฐมนตรี',
        'ส่วนราชการไม่สังกัดสำนักนายกรัฐมนตรี กระทรวง หรือทบวงและหน่วยงานภายใต้การควบคุมดูแลของนายกรัฐมนตรี': 'ส่วนราชการไม่สังกัดสำนักนายกรัฐมนตรี กระทรวง หรือทบวง และหน่วยงานภายใต้การควบคุมดูแลของนายกรัฐมนตรี',
        'กรมขนส่งทางบก': 'กรมการขนส่งทางบก',
        'อปท': 'องค์กรปกครองส่วนท้องถิ่น',
    }

    if (ministryNormalizedNameMap[ministry]) {
        return ministryNormalizedNameMap[ministry];
    }

    return ministry;
}

// Create maps to store data from each budget year
const dataMapsByYear = {
    '2565': new Map(),
    '2566': new Map(),
    '2567': new Map(),
    '2568': new Map(),
    '2569': new Map()
};
const headersByYear = {
    '2565': [],
    '2566': [],
    '2567': [],
    '2568': [],
    '2569': []
};

// Helper function to create a unique key from a row
function createKey(row) {
    return [
        normalizeMinistry(row.MINISTRY),
        normalizeMinistry(row.BUDGETARY_UNIT),
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

function readCsvIntoMap(filePath, targetMap, yearKey, setHeaders) {
    return new Promise((resolve, reject) => {
        let seenFirstRow = false;
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                if (!seenFirstRow) {
                    setHeaders(Object.keys(row));
                    seenFirstRow = true;
                }
                // Normalize ministry name in the row
                // eslint-disable-next-line no-param-reassign
                row.MINISTRY = normalizeMinistry(row.MINISTRY);

                // console.log(row.FISCAL_YEAR, +yearKey - 543, row.FISCAL_YEAR == +yearKey - 543 ? '✅' : '❌');
                if (row.FISCAL_YEAR != +yearKey - 543) {
                    // skip row
                    return;
                }

                const key = createKey(row);
                const amount = row.AMOUNT ? parseFloat(row.AMOUNT.replace(/,/g, '')) : 0;

                if (targetMap.has(key)) {
                    // Duplicate key: sum the amounts
                    const existing = targetMap.get(key);
                    existing.amount += amount;
                } else {
                    targetMap.set(key, { row, amount });
                }
            })
            .on('end', resolve)
            .on('error', reject);
    });
}

function buildHeaders() {
    const headerSet = new Set();

    // Collect all headers from all years (excluding AMOUNT and AMOUNT_LASTYEAR)
    Object.values(headersByYear).forEach((headers) => {
        headers.forEach((h) => {
            if (h !== 'AMOUNT' && h !== 'AMOUNT_LASTYEAR') {
                headerSet.add(h);
            }
        });
    });

    const baseHeaders = Array.from(headerSet);
    // Add amount columns for each year
    ['2565', '2566', '2567', '2568', '2569'].forEach((year) => {
        baseHeaders.push(`AMOUNT_${year}`);
    });
    baseHeaders.push('ROW_SOURCE');
    return baseHeaders;
}

function buildRowValues(row, headers) {
    return headers.map((h) => (row && row[h] !== undefined ? row[h] : ''));
}

function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';
    const str = value.toString();
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function writeOuterJoin() {
    const outputFile = path.join(__dirname, '../public/data-all-years.csv');
    const writeStream = fs.createWriteStream(outputFile);
    const headers = buildHeaders();
    writeStream.write(`${headers.map(escapeCsvValue).join(',')}\n`);

    // Collect all unique keys across all years
    const allKeys = new Set();
    Object.values(dataMapsByYear).forEach((dataMap) => {
        dataMap.forEach((_, key) => {
            allKeys.add(key);
        });
    });

    const years = ['2565', '2566', '2567', '2568', '2569'];
    const rowsWritten = 0;

    allKeys.forEach((key) => {
        // Get row data from first available year
        let baseRow = null;
        for (const year of years) {
            const yearData = dataMapsByYear[year].get(key);
            if (yearData) {
                baseRow = yearData.row;
                break;
            }
        }

        const values = buildRowValues(baseRow, headers);

        // Fill in amounts for each year
        years.forEach((year) => {
            const amountIndex = headers.indexOf(`AMOUNT_${year}`);
            const yearData = dataMapsByYear[year].get(key);
            if (amountIndex !== -1) {
                values[amountIndex] = yearData ? yearData.amount : '';
            }
        });

        // Determine row source
        const rowSourceIndex = headers.indexOf('ROW_SOURCE');
        if (rowSourceIndex !== -1) {
            const yearsWithData = years.filter((year) => dataMapsByYear[year].has(key));
            values[rowSourceIndex] = yearsWithData.join(',');
        }

        writeStream.write(`${values.map(escapeCsvValue).join(',')}\n`);
    });

    writeStream.end(() => {
        console.log('Processing complete! Output saved to data-all-years.csv');
        console.log(`Wrote ${allKeys.size} rows (outer join of all fiscal years 2565-2569)`);
    });
}

Promise.all([
    readCsvIntoMap(path.join(__dirname, '../public/data-65.csv'), dataMapsByYear['2565'], '2565', (h) => { headersByYear['2565'] = h; }),
    readCsvIntoMap(path.join(__dirname, '../public/data-66.csv'), dataMapsByYear['2566'], '2566', (h) => { headersByYear['2566'] = h; }),
    readCsvIntoMap(path.join(__dirname, '../public/data-67.csv'), dataMapsByYear['2567'], '2567', (h) => { headersByYear['2567'] = h; }),
    readCsvIntoMap(path.join(__dirname, '../public/data-68.csv'), dataMapsByYear['2568'], '2568', (h) => { headersByYear['2568'] = h; }),
    readCsvIntoMap(path.join(__dirname, '../public/data-69.csv'), dataMapsByYear['2569'], '2569', (h) => { headersByYear['2569'] = h; }),
])
    .then(() => {
        console.log('Finished reading all data files');
        console.log(`Loaded ${dataMapsByYear['2565'].size} entries from 2565 budget`);
        console.log(`Loaded ${dataMapsByYear['2566'].size} entries from 2566 budget`);
        console.log(`Loaded ${dataMapsByYear['2567'].size} entries from 2567 budget`);
        console.log(`Loaded ${dataMapsByYear['2568'].size} entries from 2568 budget`);
        console.log(`Loaded ${dataMapsByYear['2569'].size} entries from 2569 budget`);
        writeOuterJoin();
    })
    .catch((err) => {
        console.error('Error processing files:', err);
        process.exitCode = 1;
    });