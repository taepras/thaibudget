const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

/**
 * Outer join script for merging budget data from multiple fiscal years (2565-2569 BE)
 * Years 2565-2567 are in Thai Buddhist Era, 2568-2569 correspond to 2025-2026 CE
 */

// Normalize ministry names to canonical form
function normalizeDescription(ministry) {
    if (!ministry) return null;

    // if ministry name contains a trailing money amount, remove it (e.g. "กระทรวงการคลัง 1,000,000 บาท" -> "กระทรวงการคลัง")
    ministry = ministry.replace(/\s*\d{1,3}(,\d{3})*(\.\d+)?(\s*บาท)?$/, '').trim();

    const ministryNormalizedNameMap = {
        'รายจ่ายเพื่อชดใช้เงินคงคลัง': 'งบประมาณรายจ่ายเพื่อชดใช้เงินคงคลัง',
        'ส่วนราชการไม่สังกัดสำนักนายกรัฐมนตรีฯ': 'ส่วนราชการไม่สังกัดสำนักนายกรัฐมนตรี กระทรวง หรือทบวง และหน่วยงานภายใต้การควบคุมดูแลของนายกรัฐมนตรี',
        'ส่วนราชการไม่สังกัดสำนักนายกรัฐมนตรี กระทรวง หรือทบวงและหน่วยงานภายใต้การควบคุมดูแลของนายกรัฐมนตรี': 'ส่วนราชการไม่สังกัดสำนักนายกรัฐมนตรี กระทรวง หรือทบวง และหน่วยงานภายใต้การควบคุมดูแลของนายกรัฐมนตรี',
        'อปท': 'องค์กรปกครองส่วนท้องถิ่น',
        'ทุนหมุนเวียนที่มีฐานะเป็นนิติบุคคล': 'ทุนหมุนเวียน',
        'ทุนหมุนเวียนที่ไม่มีฐานะเป็นนิติบุคคล': 'ทุนหมุนเวียน',
        'สำนักงานสภานโยบายการอุดมศึกษา วิทยาศาสตร์': 'สํานักงานสภานโยบายการอุดมศึกษา วิทยาศาสตร์ วิจัยและนวัตกรรมแห่งชาติ',
        'สถาบันส่งเสริมการสอนวิทยาศาสตร์และเทคโนโลยี': 'สถาบันส่งเสริมการสอนวิทยาศาสตร์และเทคโนโลยี (สสวท.)',
        'สำนักปลัดกระทรวงการอุดมศึกษา วิทยาศาสตร์ วิจัยและนวัตกรรม': 'สำนักงานปลัดกระทรวงการอุดมศึกษา วิทยาศาสตร์ วิจัย และนวัตกรรม',
        'กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช P.': 'กรมอุทยานแห่งชาติ สัตว์ป่า และพันธ์ุพืช',
        'กรมทรัพยากรทางทะเลและชายฝั่ง ญ': 'กรมทรัพยากรทางทะเลและชายฝั่ง',
        'กรมสรรพกร': 'กรมสรรพากร',
        'สำนักงานคณะกรรมการพิเศษเพื่อประสานงานโครงการ อันเนื่องมาจากพระราชดำริ ส่': 'สำนักงานคณะกรรมการพิเศษเพื่อประสานงานโครงการอันเนื่องมาจากพระราชดำริ',
        'กรมส่งเสริมคุณภาพิ่งแวดล้อม': 'กรมส่งเสริมคุณภาพสิ่งแวดล้อม',
        'กรมส่งเสริมและพัฒนาคุณภาพชีวิต': 'กรมส่งเสริมและพัฒนาคุณภาพชีวิตคนพิการ',
        'สถาบันพัฒนาองค์การชุมชน (องค์การมหาชน)': 'สถาบันพัฒนาองค์กรชุมชน (องค์การมหาชน)',
        'จังหวัดนครสวรรค': 'จังหวัดนครสวรรค์',
        'สำนักงานคณะกรรมการส่งเสริมสวัสดิการและสวัสดิภาพครู': 'สำนักงานคณะกรรมการส่งเสริมสวัสดิการและสวัสดิภาพครู และบุคลากรทางการศึกษา',
        'สำนักงานคณะกรรมการการรักษาความมั่นคงปลอดภัยไซเบอร์ฯ': 'สำนักงานคณะกรรมการการรักษาความมั่นคงปลอดภัยไซเบอร์แห่งชาติ',
        'คณะกรรมการพัฒนาระบบราชการ': 'สำนักงานคณะกรรมการพัฒนาระบบราชการ',
        'สภาความมั่นคงแห่งชาติ': 'สำนักงานสภาความมั่นคงแห่งชาติ',
        'สำนักงานเลขาธิการคณะรัฐมนตรี': 'สำนักเลขาธิการคณะรัฐมนตรี',
        'สำนักงานเลขาธิการนายกรัฐมนตรี': 'สำนักเลขาธิการนายกรัฐมนตรี',
        'สำนักงานคณะกรรมการพัฒนาระบบข้าราชการ': 'สำนักงานคณะกรรมการพัฒนาระบบราชการ',

        'แผนงานบริหารจัดการหนีภาครัฐ': 'แผนงานบริหารจัดการหนี้ภาครัฐ',
        'แผนงานบูรณาการขับเคลื่อนการแก้ไขปัญหาจังหวัดชายแดนภาคใต้เการแก้': 'แผนงานบูรณาการขับเคลื่อนการแก้ไขปัญหาจังหวัดชายแดนภาคใต้',
        // 'แผนงานบูรณาการป้องกัน ปราบปราม และบำบัดรักษาผู้ติดยาเสพติด'
        // 'แผนงานบูรณาการป้องกัน ปราบปราม และแก้ไขปัญหายาเสพติด'
        'แผนงานบูรณาการพัฒนาด้านดด้านคมนาคมและระบบโลจิสติกส์': 'แผนงานบูรณาการพัฒนาด้านคมนาคมและระบบโลจิสติกส์',
        'แผนงานบูรณาการรัฐบาลดิจิทัลaedde': 'แผนงานบูรณาการรัฐบาลดิจิทัล',
        'แผนงานพื้นฐานด้านการพัฒนาและเสริมสร้างศักยภภาพทรัพยากรมนุษย์': 'แผนงานพื้นฐานด้านการพัฒนาและเสริมสร้างศักยภาพทรัพยากรมนุษย์',
        'แผนงานพื้นฐานด้านการพัฒนาและเสริมสร้างศักยภาพทรัพยากรมนุษย์ คุณภาพการศึกษา': 'แผนงานพื้นฐานด้านการพัฒนาและเสริมสร้างศักยภาพทรัพยากรมนุษย์',
        'แผนงานพื้นฐานด้านการสร้างการเติบโตบนคุณภาพชีวิตที่เป็นมิตรต่อสิ่งแวดล้อมมีตรต่อสิ่งแวดล้อม': 'แผนงานพื้นฐานด้านการสร้างการเติบโตบนคุณภาพชีวิตที่เป็นมิตรต่อสิ่งแวดล้อม',
        'แผนงานพื้นฐานด้านการสร้างคสร้างความสามารถในการแข่งขัน': 'แผนงานพื้นฐานด้านการสร้างความสามารถในการแข่งขัน',
        'แผนงานพื้นฐานด้านความมั่นคงเคง': 'แผนงานพื้นฐานด้านความมั่นคง',
        // 'แผนงานยุทธศาสตร์การส่งเสริมวิสาหกิจขนาดกลางและขนาดย่อม ที่เข้มแข็ง แข่งขันได้'
        // 'แผนงานยุทธศาสตร์การส่งเสริมวิสาหกิจขนาดกลางและขนาดย่อมที่เข้มแข็ง'
        'แผนงานยุทธศาสตร์จัดการมลพิษและสิ่งแวดล์วดล้อม': 'แผนงานยุทธศาสตร์จัดการมลพิษและสิ่งแวดล้อม',
        'แผนงานยุทธศาสตร์ป้องกันและแก้ไขปัญหาที่มีผลกระทบต่อความมั่นเมันคง': 'แผนงานยุทธศาสตร์ป้องกันและแก้ไขปัญหาที่มีผลกระทบต่อความมั่นคง',
        'แผนงานยุทธศาสตร์พัฒนากฎหมายและกระบวนการยุติธรรม6ณ': 'แผนงานยุทธศาสตร์พัฒนากฎหมายและกระบวนการยุติธรรม',
        'แผนงานยุทธศาสตร์พัฒนาคุณภาพการศึกษาและการเรียนรู้6ณ': 'แผนงานยุทธศาสตร์พัฒนาคุณภาพการศึกษาและการเรียนรู้',
        'แผนงานยุทธศาสตร์พัฒนาผู้ประกอบการ6ณและวิสาหกิจขนาดกลางและขนาดย่อม': 'แผนงานยุทธศาสตร์พัฒนาผู้ประกอบการและวิสาหกิจขนาดกลางและขนาดย่อม',
        'แผนงานยุทธศาสตร์พัฒนาพื้นที่และเมืองน่าอยู่อัจฉริยะเทีแสล': 'แผนงานยุทธศาสตร์พัฒนาพื้นที่และเมืองน่าอยู่อัจฉริยะ',
        // 'แผนงานยุทธศาสตร์พัฒนาศักยภาพการป้องกันประเทศ'
        // 'แผนงานยุทธศาสตร์พัฒนาศักยภาพการป้องกันประเทศ และความพร้อมเผชิญภัยคุกคามทุกมิติ'
        'แผนงานยุทธศาสตร์พัฒนาศักยภาพคนตลอดช่วงชีวิตde': 'แผนงานยุทธศาสตร์พัฒนาศักยภาพคนตลอดช่วงชีวิต',
        // 'แผนงานยุทธศาสตร์พัฒนาและเสริมสร้างการเมืองในระบอบประชาธิปไตย'
        'แผนงานยุทธศาสตร์พัฒนาและเสริมสร้างการเมืองในระบอบประชาธิปไตยอันมีีพระมหากษัตริย์ทรงเป็นประมุข': 'แผนงานยุทธศาสตร์พัฒนาและเสริมสร้างการเมืองในระบอบประชาธิปไตย อันมีพระมหากษัตริย์ทรงเป็นประมุข',
        'แผนงานยุทธศาสตร์ยกระดับกระบวนทัศน์เพื่อกำหนดอนาคตประเทศด้านทรัพยากรธรรมชาติ': 'แผนงานยุทธศาสตร์ยกระดับกระบวนทัศน์เพื่อกำหนดอนาคตประเทศด้านทรัพยากรธรรมชาติ และสิ่งแวดล้อม',
        'แผนงานยุทธศาสตร์สร้างควร้างความเสมอภาคทางการศึกษา': 'แผนงานยุทธศาสตร์สร้างความเสมอภาคทางการศึกษา',
        'แผนงานยุทธศาสตร์สร้างความร้างความเสมอภาคทางการศึกษา': 'แผนงานยุทธศาสตร์สร้างความเสมอภาคทางการศึกษา',
        'แผนงานยุทธศาสตร์สร้างคร้างความเสมอภาคทางการศึกษา': 'แผนงานยุทธศาสตร์สร้างความเสมอภาคทางการศึกษา',
        'แผนงานยุทธศาสตร์ส่งเสริมการพัฒนาจังหวัดและกลุ่มจังหวัดแบบบูรณาการ6ญ': 'แผนงานยุทธศาสตร์ส่งเสริมการพัฒนาจังหวัดและกลุ่มจังหวัดแบบบูรณาการ',
        'แผนงานยุทธศาสตร์เพื่อสนับสนุนด้านการสร้างการเติบโตบนคุณภาพชีวิตที่เป็นมิตร ต่อสิ่งแวดล้อม': 'แผนงานยุทธศาสตร์เพื่อสนับสนุนด้านการสร้างการเติบโตบนคุณภาพชีวิตที่เป็นมิตรต่อสิ่งแวดล้อม',
        'แผนงานยุทธศาสตร์เพื่อสนับสนุนด้านการสร้างการเติบโตบนคุณภาพชีวิตที่เป็นมิตรiตรต่อสิ่งแวดล้อมบ': 'แผนงานยุทธศาสตร์เพื่อสนับสนุนด้านการสร้างการเติบโตบนคุณภาพชีวิตที่เป็นมิตรต่อสิ่งแวดล้อม',
        'แผนงานยุทธศาสตร์เสริมสร้างให้คนมีสุขภาวะที่ดีราง': 'แผนงานยุทธศาสตร์เสริมสร้างให้คนมีสุขภาวะที่ดี',
        'แผนงานยุทธศาสตร์เสริมสร้างให้คนมีสุขภาวะที่ดีร่าง': 'แผนงานยุทธศาสตร์เสริมสร้างให้คนมีสุขภาวะที่ดี',
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
    // Compact category levels: remove empty intermediate levels so that a value
    // appearing at LV2 in one year and LV3 in another still produces the same key.
    const rawCategories = [
        normalizeDescription(row.CATEGORY_LV1),
        normalizeDescription(row.CATEGORY_LV2),
        normalizeDescription(row.CATEGORY_LV3),
        normalizeDescription(row.CATEGORY_LV4),
        normalizeDescription(row.CATEGORY_LV5),
        normalizeDescription(row.CATEGORY_LV6),
    ];
    const compactedCategories = rawCategories.filter((v) => v != null && v !== '');
    // Pad to 6 slots so the join width is stable
    while (compactedCategories.length < 6) compactedCategories.push('');

    return [
        normalizeDescription(row.MINISTRY),
        normalizeDescription(row.BUDGETARY_UNIT),
        compactedCategories[0] ?? 'ไม่ระบุประเภท',
        ...compactedCategories.slice(1),
        row.ITEM_DESCRIPTION
    ].join('||');
}

// Columns whose string values should be fuzzy-merged
const TEXT_COLUMNS = [
    'MINISTRY', 'BUDGETARY_UNIT', 'BUDGET_PLAN', 'CROSS_FUNC?',
    'OUTPUT', 'PROJECT',
    'CATEGORY_LV1', 'CATEGORY_LV2', 'CATEGORY_LV3',
    'CATEGORY_LV4', 'CATEGORY_LV5', 'CATEGORY_LV6',
    'ITEM_DESCRIPTION',
];

// Substring replacements applied via replaceAll to every text column in every row.
// Works for both whole-cell renames and within-string OCR corrections.
// Applied before the fuzzy alias pass.
const REPLACEMENTS = [
    ['สำนักปลัด', 'สำนักงานปลัด'],
    ['องค์กรมหาชน', 'องค์การมหาชน'],
    ['เองค์การมหาชน', 'องค์การมหาชน'], // OCR: leading เ added before องค์การมหาชน in some rows
    ['ทางาน', 'ทำงาน'],   // OCR: sara am ำ dropped from ทำงาน
    ['์ุ', 'ุ์'],          // OCR: sara u ุ and thanthakat ์ swapped (e.g. พันธ์ุ -> พันธุ์)
    ['\u0e4d\u0e32', 'ำ'],    // Unicode: nikhahit+sara-a (U+0E4D U+0E32) -> sara-am (U+0E33), visually identical
    ['de u', ''],
    ['ตารวจ', 'ตำรวจ'],
    ['นำ้', 'น้ำ'],
    ['ความมันคง', 'ความมั่นคง'],
    ['กล่ม', 'กลุ่ม'],
    ['ศาสตรส่งเสริม', 'ศาสตร์ส่งเสริม'],
    ['เฉียงหนือ', 'เฉียงเหนือ'],
    ['สุราษฎ์', 'สุราษฎร์'],
    ['สิงค์บุรี', 'สิงห์บุรี'],
    ['หนองบัวล่าภู', 'หนองบัวลำภู'],
    ['ล่าปาง', 'ลำปาง'],
    ['ล่าพูน', 'ลำพูน'],
    ['การท่องเที่ยวกีฬา', 'การท่องเที่ยวและกีฬา'],
    ['ปลดั', 'ปลัด'],
    ['ทองถิน', 'ท้องถิ่น'],
    ['ทองถิ่น', 'ท้องถิ่น'],
    ['ฏีกา', 'ฎีกา'],
    ['กรมสถาบัน', 'สถาบัน'],
    ['มกุฏ', 'มกุฎ'],
    ['ไชเบอร์', 'ไซเบอร์'],  // OCR: ซ (so) misread as ช (cho) in ไซเบอร์ (cyber)
    ['ทรัพยากรนำ', 'ทรัพยากรน้ำ'],
    ['บริการจัดการ', 'บริหารจัดการ'],
    ['งบรายจ่ายอิน', 'งบรายจ่ายอื่น'],
    ['งบรายจ่ายอิ่น', 'งบรายจ่ายอื่น'],
    ['อุ ดหนุน', 'อุดหนุน'],
    ['ดาเนินงาน', 'ดำเนินงาน'],
    ['ช าระ', 'ชำระ'],
    ['ที่ดีดี', 'ที่ดี'],
    ['บริหารจัดการภาครัฐข', 'บริหารจัดการภาครัฐ'],  // OCR: stray ข appended after ภาครัฐ
    ['สงเสริม', 'ส่งเสริม'],  // OCR: dropped mai ek tone mark on ส่งเสริม (to promote)
    ['หรัพยากร', 'ทรัพยากร'],  // OCR: ท (tho) misread as ห (ho) in ทรัพยากร (resources)
];

// Strip spaces, entire (...) groups, unclosed ( fragments, and optional การ for fuzzy comparison.
// Removing the whole (xxx) block means a name with and without a parenthetical
// suffix (e.g. (องค์การมหาชน)) will share the same key and be merged.
// The second replace also handles unclosed parens like (องค์การมหาชน with no closing ).
function stripForCompare(str) {
    return str.replace(/\([^)]*\)/g, '').replace(/\([^)]*$/g, '').replace(/[\s()]/g, '').replace(/การ/g, '').replace(/ทาง/g, '').replace(/แห่งชาติ/g, '');
}

// Among variant spellings of the same name, pick the most complete one:
// 1. prefer balanced parentheses  2. most parenthetical groups  3. most การ  4. most ทาง  5. most spaces
function pickCanonical(variants) {
    const balanced = variants.filter((v) => {
        const opens = (v.match(/\(/g) || []).length;
        const closes = (v.match(/\)/g) || []).length;
        return opens === closes;
    });
    const pool = balanced.length > 0 ? balanced : variants;
    return pool.reduce((best, v) => {
        const vParens = (v.match(/\(/g) || []).length;
        const bestParens = (best.match(/\(/g) || []).length;
        if (vParens !== bestParens) return vParens > bestParens ? v : best;
        const vKar = (v.match(/การ/g) || []).length;
        const bestKar = (best.match(/การ/g) || []).length;
        if (vKar !== bestKar) return vKar > bestKar ? v : best;
        const vTang = (v.match(/ทาง/g) || []).length;
        const bestTang = (best.match(/ทาง/g) || []).length;
        if (vTang !== bestTang) return vTang > bestTang ? v : best;
        const vHangChart = (v.match(/แห่งชาติ/g) || []).length;
        const bestHangChart = (best.match(/แห่งชาติ/g) || []).length;
        if (vHangChart !== bestHangChart) return vHangChart > bestHangChart ? v : best;
        return (v.match(/ /g) || []).length > (best.match(/ /g) || []).length ? v : best;
    });
}

// Scan every text column of every loaded row, group by stripped form,
// return a Map<variant -> canonical> for variants that differ from their canonical.
function buildAliasMap() {
    const groups = new Map(); // stripKey -> Set<original string>
    Object.values(dataMapsByYear).forEach((dataMap) => {
        dataMap.forEach(({ row }) => {
            TEXT_COLUMNS.forEach((col) => {
                const val = row[col];
                if (!val) return;
                const key = stripForCompare(val);
                if (!groups.has(key)) groups.set(key, new Set());
                groups.get(key).add(val);
            });
        });
    });

    const aliasMap = new Map();
    groups.forEach((variants) => {
        const arr = Array.from(variants);
        if (arr.length < 2) return;
        const canonical = pickCanonical(arr);
        arr.forEach((v) => { if (v !== canonical) aliasMap.set(v, canonical); });
    });
    return aliasMap;
}

// Apply REPLACEMENTS via replaceAll to every text column, then re-key and re-merge
// any rows whose key changed as a result.
function applyReplacements() {
    if (REPLACEMENTS.length === 0) return;
    Object.keys(dataMapsByYear).forEach((year) => {
        const oldMap = dataMapsByYear[year];
        const newMap = new Map();
        oldMap.forEach(({ row, amount }) => {
            TEXT_COLUMNS.forEach((col) => {
                if (!row[col]) return;
                REPLACEMENTS.forEach(([find, replace]) => {
                    if (row[col].includes(find)) row[col] = row[col].replaceAll(find, replace);
                });
            });
            const newKey = createKey(row);
            if (newMap.has(newKey)) {
                newMap.get(newKey).amount += amount;
            } else {
                newMap.set(newKey, { row, amount });
            }
        });
        dataMapsByYear[year] = newMap;
    });
}

// any rows whose key changed because of the normalization.
function rebuildDataMapsWithAliases(aliasMap) {
    Object.keys(dataMapsByYear).forEach((year) => {
        const oldMap = dataMapsByYear[year];
        const newMap = new Map();
        oldMap.forEach(({ row, amount }) => {
            TEXT_COLUMNS.forEach((col) => {
                if (row[col] && aliasMap.has(row[col])) row[col] = aliasMap.get(row[col]);
            });
            const newKey = createKey(row);
            if (newMap.has(newKey)) {
                newMap.get(newKey).amount += amount;
            } else {
                newMap.set(newKey, { row, amount });
            }
        });
        dataMapsByYear[year] = newMap;
    });
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

                // Normalize ministry, budgetary unit, and budget plan names in the row
                // eslint-disable-next-line no-param-reassign
                row.MINISTRY = normalizeDescription(row.MINISTRY);
                row.BUDGETARY_UNIT = normalizeDescription(row.BUDGETARY_UNIT);
                row.BUDGET_PLAN = normalizeDescription(row.BUDGET_PLAN) ?? 'ไม่ระบุแผนงาน';
                row.OUTPUT = normalizeDescription(row.OUTPUT);
                row.PROJECT = normalizeDescription(row.PROJECT);
                row.CATEGORY_LV1 = normalizeDescription(row.CATEGORY_LV1) ?? 'ไม่ระบุประเภท';
                row.CATEGORY_LV2 = normalizeDescription(row.CATEGORY_LV2);
                row.CATEGORY_LV3 = normalizeDescription(row.CATEGORY_LV3);
                row.CATEGORY_LV4 = normalizeDescription(row.CATEGORY_LV4);
                row.CATEGORY_LV5 = normalizeDescription(row.CATEGORY_LV5);
                row.CATEGORY_LV6 = normalizeDescription(row.CATEGORY_LV6);

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
            if (h !== 'AMOUNT' && h !== 'AMOUNT_LASTYEAR' && h !== 'FISCAL_YEAR') {
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
    // Obliged multi-year span columns
    baseHeaders.push('OBLIGED_YEAR_START');
    baseHeaders.push('OBLIGED_YEAR_END');
    baseHeaders.push('OBLIGED_TOTAL_AMOUNT');
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
    const outputFile = path.join(__dirname, '../data/data-all-years.csv');
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
        // Get row data from latest available year (later years tend to have cleaner OCR)
        let baseRow = null;
        for (const year of [...years].reverse()) {
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
        const yearsWithData = years.filter((year) => dataMapsByYear[year].has(key));
        if (rowSourceIndex !== -1) {
            values[rowSourceIndex] = yearsWithData.join(',');
        }

        // Obliged multi-year span: compute start/end year and total amount.
        // Only populated for rows where OBLIGED?=true in at least one year.
        const obligedYears = yearsWithData.filter((year) => {
            const yearData = dataMapsByYear[year].get(key);
            return yearData && String(yearData.row['OBLIGED?']).toLowerCase() === 'true';
        });
        const nonObligedYears = yearsWithData.filter((year) => {
            const yearData = dataMapsByYear[year].get(key);
            return yearData && String(yearData.row['OBLIGED?']).toLowerCase() !== 'true';
        });

        // Flag inconsistency: same item marked OBLIGED?=TRUE in some years and FALSE in others
        if (obligedYears.length > 0 && nonObligedYears.length > 0) {
            console.warn(
                `🔴 OBLIGED inconsistency for key [${baseRow.ITEM_DESCRIPTION}] (${baseRow.MINISTRY} / ${baseRow.BUDGETARY_UNIT}):`,
                `TRUE in years [${obligedYears.join(',')}], FALSE in years [${nonObligedYears.join(',')}]`
            );
        }

        const obligedYearStartIndex = headers.indexOf('OBLIGED_YEAR_START');
        const obligedYearEndIndex = headers.indexOf('OBLIGED_YEAR_END');
        const obligedTotalIndex = headers.indexOf('OBLIGED_TOTAL_AMOUNT');
        if (obligedYears.length > 0) {
            if (obligedYearStartIndex !== -1) values[obligedYearStartIndex] = Math.min(...obligedYears);
            if (obligedYearEndIndex !== -1) values[obligedYearEndIndex] = Math.max(...obligedYears);
            if (obligedTotalIndex !== -1) {
                const total = obligedYears.reduce((sum, year) => {
                    const yearData = dataMapsByYear[year].get(key);
                    return sum + (yearData ? yearData.amount : 0);
                }, 0);
                values[obligedTotalIndex] = total;
            }
        }

        writeStream.write(`${values.map(escapeCsvValue).join(',')}\n`);
    });

    writeStream.end(() => {
        console.log('Processing complete! Output saved to data-all-years.csv');
        console.log(`Wrote ${allKeys.size} rows (outer join of all fiscal years 2565-2569)`);
    });
}

Promise.all([
    readCsvIntoMap(path.join(__dirname, '../data/data-65.csv'), dataMapsByYear['2565'], '2565', (h) => { headersByYear['2565'] = h; }),
    readCsvIntoMap(path.join(__dirname, '../data/data-66.csv'), dataMapsByYear['2566'], '2566', (h) => { headersByYear['2566'] = h; }),
    readCsvIntoMap(path.join(__dirname, '../data/data-67.csv'), dataMapsByYear['2567'], '2567', (h) => { headersByYear['2567'] = h; }),
    readCsvIntoMap(path.join(__dirname, '../data/data-68.csv'), dataMapsByYear['2568'], '2568', (h) => { headersByYear['2568'] = h; }),
    readCsvIntoMap(path.join(__dirname, '../data/data-69.csv'), dataMapsByYear['2569'], '2569', (h) => { headersByYear['2569'] = h; }),
])
    .then(() => {
        console.log('Finished reading all data files');
        console.log(`Loaded ${dataMapsByYear['2565'].size} entries from 2565 budget`);
        console.log(`Loaded ${dataMapsByYear['2566'].size} entries from 2566 budget`);
        console.log(`Loaded ${dataMapsByYear['2567'].size} entries from 2567 budget`);
        console.log(`Loaded ${dataMapsByYear['2568'].size} entries from 2568 budget`);
        console.log(`Loaded ${dataMapsByYear['2569'].size} entries from 2569 budget`);

        applyReplacements();
        console.log(`Applied ${REPLACEMENTS.length} replacement rule(s)`);

        const aliasMap = buildAliasMap();
        console.log(`Built ${aliasMap.size} fuzzy-name aliases (ignoring spaces & parentheses)`);
        if (aliasMap.size > 0) {
            console.log('Sample aliases:');
            let shown = 0;
            aliasMap.forEach((canonical, variant) => {
                if (shown++ < 10) console.log(`  "${variant}" -> "${canonical}"`);
            });
        }
        rebuildDataMapsWithAliases(aliasMap);
        console.log('Rebuilt data maps with normalized names');

        writeOuterJoin();
    })
    .catch((err) => {
        console.error('Error processing files:', err);
        process.exitCode = 1;
    });