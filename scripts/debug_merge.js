const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const data69ByMinistry = new Map();
const mergedByMinistry = new Map();

function parseAmount(amountStr) {
    if (!amountStr) return 0;
    const num = parseFloat(amountStr.toString().replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
}

// Read data-69.csv and group by ministry
fs.createReadStream(path.join(__dirname, '../public/data-69.csv'))
    .pipe(csv())
    .on('data', (row) => {
        if (row.FISCAL_YEAR === '2026') {
            const ministry = row.MINISTRY;
            const amount = parseAmount(row.AMOUNT);
            if (!data69ByMinistry.has(ministry)) {
                data69ByMinistry.set(ministry, 0);
            }
            data69ByMinistry.set(ministry, data69ByMinistry.get(ministry) + amount);
        }
    })
    .on('end', () => {
        console.log('=== Data-69.csv (FISCAL_YEAR=2026) ===');
        console.log(`Total ministries: ${data69ByMinistry.size}`);
        const sortedData69 = Array.from(data69ByMinistry.entries())
            .sort((a, b) => b[1] - a[1]);
        sortedData69.forEach(([ministry, sum]) => {
            console.log(`${ministry}: ${sum.toLocaleString()}`);
        });
        console.log(`\nGrand total: ${Array.from(data69ByMinistry.values()).reduce((a, b) => a + b, 0).toLocaleString()}`);
        
        // Now read merged file
        readMergedFile();
    });

function readMergedFile() {
    fs.createReadStream(path.join(__dirname, '../public/data-69-with-68.csv'))
        .pipe(csv())
        .on('data', (row) => {
            if (row.FISCAL_YEAR === '2026') {
                const ministry = row.MINISTRY;
                const amount = parseAmount(row.AMOUNT_69);
                if (!mergedByMinistry.has(ministry)) {
                    mergedByMinistry.set(ministry, 0);
                }
                mergedByMinistry.set(ministry, mergedByMinistry.get(ministry) + amount);
            }
        })
        .on('end', () => {
            console.log('\n=== Data-69-with-68.csv (FISCAL_YEAR=2026, AMOUNT_69) ===');
            console.log(`Total ministries: ${mergedByMinistry.size}`);
            const sortedMerged = Array.from(mergedByMinistry.entries())
                .sort((a, b) => b[1] - a[1]);
            sortedMerged.forEach(([ministry, sum]) => {
                console.log(`${ministry}: ${sum.toLocaleString()}`);
            });
            console.log(`\nGrand total: ${Array.from(mergedByMinistry.values()).reduce((a, b) => a + b, 0).toLocaleString()}`);

            // Compare
            console.log('\n=== COMPARISON ===');
            const allMinistries = new Set([...data69ByMinistry.keys(), ...mergedByMinistry.keys()]);
            const differences = [];
            allMinistries.forEach((ministry) => {
                const orig = data69ByMinistry.get(ministry) || 0;
                const merged = mergedByMinistry.get(ministry) || 0;
                const diff = orig - merged;
                if (diff !== 0) {
                    differences.push({ ministry, orig, merged, diff });
                }
            });

            if (differences.length === 0) {
                console.log('✓ All sums match!');
            } else {
                console.log(`✗ ${differences.length} ministries have different sums:`);
                differences.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
                differences.forEach(({ ministry, orig, merged, diff }) => {
                    console.log(`  ${ministry}:`);
                    console.log(`    data-69:          ${orig.toLocaleString()}`);
                    console.log(`    merged (AMOUNT_69): ${merged.toLocaleString()}`);
                    console.log(`    difference:       ${diff > 0 ? '+' : ''}${diff.toLocaleString()}`);
                });
            }
        });
}
