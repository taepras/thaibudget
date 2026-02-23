const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Transform } = require('stream');
const fastcsv = require('fast-csv');

// Create a map to store data from 2568 (2025) budget
const data68Map = new Map();

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

// First pass: Read data-68.csv and create lookup map
fs.createReadStream(path.join(__dirname, '../public/data-68.csv'))
    .pipe(csv())
    .on('data', (row) => {
        const key = createKey(row);
        // Remove commas and store as clean number
        const amount = row.AMOUNT ? row.AMOUNT.replace(/,/g, '') : '';
        data68Map.set(key, amount);
    })
    .on('end', () => {
        console.log('Finished reading data-68.csv');
        console.log(`Loaded ${data68Map.size} entries from 2568 budget`);
        processData69();
    });

function processData69() {
    const outputFile = path.join(__dirname, '../public/data-69-with-68.csv');
    const writeStream = fs.createWriteStream(outputFile);
    
    // Add header with new column
    let isFirstRow = true;

    const transformStream = new Transform({
        objectMode: true,
        transform(row, encoding, callback) {
            if (isFirstRow) {
                // Add new column header
                const headers = Object.keys(row);
                headers.push('AMOUNT_LASTYEAR');
                writeStream.write(headers.join(',') + '\n');
                isFirstRow = false;
            }

            // Find matching amount from 2568
            const key = createKey(row);
            const amount68 = data68Map.get(key) || '';

            // Write the row with the new column
            const values = [...Object.values(row), amount68];
            writeStream.write(values.join(',') + '\n');
            
            callback();
        }
    });

    fs.createReadStream(path.join(__dirname, '../public/data-69.csv'))
        .pipe(csv())
        .pipe(transformStream)
        .on('finish', () => {
            console.log('Processing complete! Output saved to data-69-with-68.csv');
        });
}