const { Pool } = require('pg');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const DB_URL = "postgresql://neondb_owner:npg_4aS3XGvWsijz@ep-falling-hill-az6l7swx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
});

// Helper function to identify building key from flat name
function getBuildingName(flatStr) {
    const clean = String(flatStr).trim().toUpperCase();
    if (clean.startsWith('A-')) return 'Building_A';
    if (clean.startsWith('B-')) return 'Building_B';
    if (clean.startsWith('C-')) return 'Building_C';
    if (clean.startsWith('D1-')) return 'Building_D1';
    if (clean.startsWith('D2-')) return 'Building_D2';
    if (clean.startsWith('E-')) return 'Building_E';
    if (clean.startsWith('F1-')) return 'Building_F1';
    return 'Other_Building';
}

async function generateBuildingWiseExcelReports() {
    console.log("🔄 Fetching receipt records from Neon Database...\n");

    try {
        // 1. Fetch all receipts from DB
        const dbRes = await pool.query(
            `SELECT receipt_no, LOWER(TRIM(flat)) AS flat_clean, flat, date 
             FROM receipts 
             ORDER BY receipt_no ASC`
        );

        console.log(`📊 Total receipt rows in DB: ${dbRes.rows.length}`);

        // Track unique flats and detect duplicates
        const dbPaidMap = {};
        const flatCounts = {};
        const duplicateFlats = [];

        dbRes.rows.forEach(row => {
            if (row.flat_clean) {
                flatCounts[row.flat_clean] = (flatCounts[row.flat_clean] || 0) + 1;

                if (flatCounts[row.flat_clean] === 2) {
                    duplicateFlats.push(row.flat);
                }

                dbPaidMap[row.flat_clean] = {
                    date: row.date,
                    originalFlat: row.flat,
                    matched: false
                };
            }
        });

        console.log(`✅ Unique flat numbers in DB: ${Object.keys(dbPaidMap).length}`);

        // 2. Read Master Excel File
        let excelFileName = 'Flat_Master_List.xlsx';
        if (!fs.existsSync(path.join(__dirname, excelFileName))) {
            if (fs.existsSync(path.join(__dirname, 'Flat_Master_List.xlss'))) {
                excelFileName = 'Flat_Master_List.xlss';
            } else if (fs.existsSync(path.join(__dirname, 'Flat_Master_List.xls'))) {
                excelFileName = 'Flat_Master_List.xls';
            }
        }

        const excelPath = path.join(__dirname, excelFileName);
        if (!fs.existsSync(excelPath)) {
            throw new Error(`Master Excel file not found at ${excelPath}`);
        }

        console.log(`📖 Reading Excel file: ${excelFileName}...`);

        const workbook = xlsx.readFile(excelPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

        // Group rows by Building
        const buildingGroups = {};

        rows.forEach(row => {
            const rawFlatKey = Object.keys(row).find(k => k.toLowerCase().includes('flat')) || 'Flat ID';
            const rawFlatVal = String(row[rawFlatKey] || '').trim();
            const flatIdClean = rawFlatVal.toLowerCase();

            // Match payment status from DB
            if (flatIdClean && dbPaidMap[flatIdClean]) {
                row['Payment'] = 'Paid';
                row['Date'] = dbPaidMap[flatIdClean].date;
                dbPaidMap[flatIdClean].matched = true;
            } else {
                row['Payment'] = row['Payment'] || '';
                row['Date'] = row['Date'] || '';
            }

            // Categorize into building group
            const bName = getBuildingName(rawFlatVal);
            if (!buildingGroups[bName]) {
                buildingGroups[bName] = [];
            }
            buildingGroups[bName].push(row);
        });

        // 3. Ensure Output Directory Exists
        const outputDir = path.join(__dirname, 'Building_Reports');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        console.log("\n📁 Generating Building-Wise Excel Files...\n");

        // 4. Export individual Excel files
        for (const [buildingName, groupRows] of Object.entries(buildingGroups)) {
            const newWb = xlsx.utils.book_new();
            const newWs = xlsx.utils.json_to_sheet(groupRows);

            xlsx.utils.book_append_sheet(newWb, newWs, buildingName);

            const fileSavePath = path.join(outputDir, `Report_${buildingName}.xlsx`);
            xlsx.writeFile(newWb, fileSavePath);

            const paidCount = groupRows.filter(r => r['Payment'] === 'Paid').length;
            console.log(` 📄 Created: Report_${buildingName}.xlsx ➔ (${paidCount}/${groupRows.length} Paid)`);
        }

        // ====================================================
        // AUDIT REPORT: DUPLICATES & UNMATCHED
        // ====================================================
        console.log("\n--------------------------------------------------");
        if (duplicateFlats.length > 0) {
            console.log(`🔁 DUPLICATE RECEIPTS FOUND IN DB (${duplicateFlats.length}):`);
            duplicateFlats.forEach(f => console.log(`   - Flat: ${f}`));
        } else {
            console.log("🔁 No duplicate flat entries in DB.");
        }

        const unmatchedInExcel = Object.values(dbPaidMap).filter(item => !item.matched);
        if (unmatchedInExcel.length > 0) {
            console.log(`\n⚠️ FLATS IN DB BUT NOT FOUND IN EXCEL (${unmatchedInExcel.length}):`);
            unmatchedInExcel.forEach(item => console.log(`   - Flat: ${item.originalFlat} (Date: ${item.date})`));
        } else {
            console.log("✅ All DB flats were successfully matched in Excel!");
        }
        console.log("--------------------------------------------------\n");

        console.log(`🎉 Process Complete! All building reports saved in:\n👉 ${outputDir}\n`);

    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        await pool.end();
    }
}

generateBuildingWiseExcelReports();