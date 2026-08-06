require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('@neondatabase/serverless');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// 1. CONFIGURATION & CREDENTIALS
let DB_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_4aS3XGvWsijz@ep-falling-hill-az6l7swx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
if (DB_URL.includes('sslmode=')) {
    DB_URL = DB_URL.replace(/sslmode=[^&]*/, 'sslmode=verify-full');
} else {
    DB_URL += (DB_URL.includes('?') ? '&' : '?') + 'sslmode=verify-full';
}

const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL || process.env.ADMIN_EMAIL || "parmar.loken@gmail.com";

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

async function runDailyReportAndEmail() {
    console.log("⚡ Connecting to Neon DB over WebSockets...");

    const client = new Client({ connectionString: DB_URL });

    try {
        await client.connect();

        // 1. Fetch Receipts
        const dbRes = await client.query(
            `SELECT receipt_no, LOWER(TRIM(flat)) AS flat_clean, flat, date 
             FROM receipts 
             ORDER BY receipt_no ASC`
        );

        const dbPaidMap = {};
        const flatCounts = {};
        const duplicateFlats = [];

        dbRes.rows.forEach(row => {
            if (row.flat_clean) {
                flatCounts[row.flat_clean] = (flatCounts[row.flat_clean] || 0) + 1;
                if (flatCounts[row.flat_clean] === 2) duplicateFlats.push(row.flat);

                dbPaidMap[row.flat_clean] = {
                    date: row.date,
                    originalFlat: row.flat,
                    matched: false
                };
            }
        });

        // 2. Process Master Excel
        let excelFileName = 'Flat_Master_List.xlsx';
        if (!fs.existsSync(path.join(__dirname, excelFileName))) {
            if (fs.existsSync(path.join(__dirname, 'Flat_Master_List.xlss'))) excelFileName = 'Flat_Master_List.xlss';
            else if (fs.existsSync(path.join(__dirname, 'Flat_Master_List.xls'))) excelFileName = 'Flat_Master_List.xls';
        }

        const excelPath = path.join(__dirname, excelFileName);
        if (!fs.existsSync(excelPath)) throw new Error(`Master Excel file not found: ${excelPath}`);

        const workbook = xlsx.readFile(excelPath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

        const buildingGroups = {};

        rows.forEach(row => {
            const rawFlatKey = Object.keys(row).find(k => k.toLowerCase().includes('flat')) || 'Flat ID';
            const rawFlatVal = String(row[rawFlatKey] || '').trim();
            const flatIdClean = rawFlatVal.toLowerCase();

            if (flatIdClean && dbPaidMap[flatIdClean]) {
                row['Payment'] = 'Paid';
                row['Date'] = dbPaidMap[flatIdClean].date;
                dbPaidMap[flatIdClean].matched = true;
            } else {
                row['Payment'] = row['Payment'] || '';
                row['Date'] = row['Date'] || '';
            }

            const bName = getBuildingName(rawFlatVal);
            if (!buildingGroups[bName]) buildingGroups[bName] = [];
            buildingGroups[bName].push(row);
        });

        // 3. Save Date-Stamped Building Reports
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
        const outputDir = path.join(__dirname, 'Building_Reports');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

        const emailAttachments = [];

        for (const [buildingName, groupRows] of Object.entries(buildingGroups)) {
            const newWb = xlsx.utils.book_new();
            const newWs = xlsx.utils.json_to_sheet(groupRows);
            xlsx.utils.book_append_sheet(newWb, newWs, buildingName);

            const fileNameWithDate = `Report_${buildingName}_${dateStr}.xlsx`;
            const fileSavePath = path.join(outputDir, fileNameWithDate);
            xlsx.writeFile(newWb, fileSavePath);

            // Resend API Base64 attachment format
            emailAttachments.push({
                filename: fileNameWithDate,
                content: fs.readFileSync(fileSavePath).toString('base64')
            });
        }

        // 4. Send Email via Direct HTTPS Fetch (Port 443 - Never Blocked on Render)
        console.log("🚀 Dispatching Email via Resend HTTPS API (Port 443)...");

        const todayFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        const recipientList = RECIPIENT_EMAIL.includes(',')
            ? RECIPIENT_EMAIL.split(',').map(e => e.trim())
            : [RECIPIENT_EMAIL.trim()];

        const resendPayload = {
            from: 'Purvanchal Portal <onboarding@resend.dev>',
            to: recipientList,
            subject: `📊 Building Collection Reports - ${todayFormatted}`,
            html: `
                <h3>Purvanchal Ganeshotsav Portal - Daily Collection Reports</h3>
                <p>Hello Admin,</p>
                <p>Attached are the updated building-wise collection spreadsheets generated for <strong>${todayFormatted}</strong>.</p>
                <p><strong>Attached Reports:</strong> ${emailAttachments.length} Building Excel Files</p>
            `,
            attachments: emailAttachments
        };

        const apiResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(resendPayload)
        });

        const resData = await apiResponse.json();

        if (!apiResponse.ok) {
            throw new Error(`Resend HTTPS Error: ${resData.message || JSON.stringify(resData)}`);
        }

        console.log("🎉 Email sent successfully via Resend HTTPS API! ID:", resData.id);

        return {
            success: true,
            count: emailAttachments.length,
            receipts: dbRes.rows.length,
            duplicates: duplicateFlats,
            dateStr
        };

    } catch (error) {
        throw error;
    } finally {
        await client.end().catch(() => { });
    }
}

module.exports = { runDailyReportAndEmail };

if (require.main === module) {
    runDailyReportAndEmail()
        .then(res => console.log("🎉 Complete:", res))
        .catch(err => console.error("❌ Failed:", err));
}