const { Client } = require('pg');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// ====================================================
// 1. CONFIGURATION & CREDENTIALS
// ====================================================
// Standardize SSL parameters to avoid driver hangs on Render
let DB_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_4aS3XGvWsijz@ep-falling-hill-az6l7swx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

// Clean SSL parameters for node-postgres compatibility
if (!DB_URL.includes('sslmode=')) {
    DB_URL += (DB_URL.includes('?') ? '&' : '?') + 'sslmode=require';
}

// Email Credentials
const EMAIL_USER = process.env.SENDER_EMAIL || "YOUR_GMAIL_ADDRESS@gmail.com";
const EMAIL_PASS = process.env.SENDER_APP_PASSWORD || "YOUR_16_CHAR_APP_PASSWORD";
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL || EMAIL_USER;

// Helper: Extract Building Name from Flat Identifier
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

// ====================================================
// 2. MAIN WORKFLOW FUNCTION
// ====================================================
async function runDailyReportAndEmail() {
    console.log("🔄 Connecting to Neon Database...");

    // Using single Client instance with strict 15s timeout
    const client = new Client({
        connectionString: DB_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
    });

    try {
        await client.connect();
        console.log("✅ DB Connected successfully.");

        // 1. Query Receipts from Neon DB
        const dbRes = await client.query(
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

        // 3. Generate Formatted Date String for File Names (dd-mm-yyyy)
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${day}-${month}-${year}`;

        const outputDir = path.join(__dirname, 'Building_Reports');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const emailAttachments = [];

        console.log("\n📁 Generating Date-Stamped Building Excel Files...\n");

        for (const [buildingName, groupRows] of Object.entries(buildingGroups)) {
            const newWb = xlsx.utils.book_new();
            const newWs = xlsx.utils.json_to_sheet(groupRows);
            xlsx.utils.book_append_sheet(newWb, newWs, buildingName);

            const fileNameWithDate = `Report_${buildingName}_${dateStr}.xlsx`;
            const fileSavePath = path.join(outputDir, fileNameWithDate);
            xlsx.writeFile(newWb, fileSavePath);

            const paidCount = groupRows.filter(r => r['Payment'] === 'Paid').length;
            console.log(` 📄 Created: ${fileNameWithDate} ➔ (${paidCount}/${groupRows.length} Paid)`);

            emailAttachments.push({
                filename: fileNameWithDate,
                path: fileSavePath
            });
        }

        // ====================================================
        // AUDIT LOGGING
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

        // 4. Send Email via Nodemailer (Forced IPv4)
        console.log("📧 Sending email with attached reports...");

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            family: 4, // Forces IPv4 on Render
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS
            }
        });

        const todayFormatted = `${day}/${month}/${year}`;

        const mailOptions = {
            from: `"Purvanchal Portal Reports" <${EMAIL_USER}>`,
            to: RECIPIENT_EMAIL,
            subject: `📊 Building Collection Reports - ${todayFormatted}`,
            html: `
                <h3>Purvanchal Ganeshotsav Portal - Daily Collection Reports</h3>
                <p>Hello Admin,</p>
                <p>Attached are the updated building-wise collection spreadsheets generated for <strong>${todayFormatted}</strong>.</p>
                <p><strong>Attached Reports:</strong> ${emailAttachments.length} Building Excel Files</p>
                <br/>
                <p><em>Automated system report.</em></p>
            `,
            attachments: emailAttachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("🎉 Email successfully sent! Message ID:", info.messageId);

    } catch (error) {
        console.error("❌ Process Failed:", error.message);
        process.exit(1);
    } finally {
        await client.end().catch(() => { });
    }
}

// Execute
runDailyReportAndEmail();