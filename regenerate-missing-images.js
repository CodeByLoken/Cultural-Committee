const { Pool } = require('pg');
const fetch = require('node-fetch');
const { generateReceiptPDF } = require('./services/pdfService');

// Updated connection string with sslmode=verify-full to fix SSL warning
const connectionString = "postgresql://neondb_owner:npg_4aS3XGvWsijz@ep-falling-hill-az6l7swx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full";

// Replace with your active Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzLE686MbDnfe2rwnQa715tw99al8rMjAvpXeuH8WKrlN9xF3nH6DTez_klUNVUGY_o/exec';


const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function processMissingImages() {
    const client = await pool.connect();

    try {
        console.log("Searching for receipts with missing image_url...");

        const query = `
      SELECT receipt_no, date AS today, name, whatsapp, flat, amount, amount_words, family_count, payment_mode, collected_by
      FROM receipts
      WHERE image_url IS NULL OR image_url = '' OR image_url = 'EMPTY_STRING'
      ORDER BY receipt_no ASC;
    `;

        const { rows } = await client.query(query);

        if (rows.length === 0) {
            console.log("✓ All records already have valid image URLs! Nothing to update.");
            process.exit(0);
        }

        console.log(`Found ${rows.length} records needing image generation.\n`);

        for (const [index, row] of rows.entries()) {
            console.log(`[${index + 1}/${rows.length}] Processing Receipt #${row.receipt_no} for ${row.name} (${row.flat})...`);

            try {
                // 1. Generate PNG Screenshot
                const pdfResult = await generateReceiptPDF({
                    receiptNo: row.receipt_no,
                    name: row.name,
                    whatsapp: row.whatsapp,
                    flat: row.flat,
                    amount: row.amount,
                    amountWords: row.amount_words || "",
                    familyCount: row.family_count,
                    paymentMode: row.payment_mode,
                    collectedBy: row.collected_by,
                    today: row.today,
                    lang: 'en'
                });

                if (!pdfResult || !pdfResult.imageBase64) {
                    console.error(`❌ Failed to render image for Receipt #${row.receipt_no}`);
                    continue;
                }

                // Clean base64 string if prefixed
                const base64Clean = pdfResult.imageBase64.replace(/^data:image\/\w+;base64,/, '');

                // 2. Upload image to Google Drive
                const driveRes = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'saveImage',
                        receiptNo: row.receipt_no,
                        flat: row.flat,
                        imageBase64: base64Clean
                    }),
                    redirect: 'follow'
                });

                const driveText = await driveRes.text();
                const driveData = JSON.parse(driveText);
                const imageUrl = driveData.imageUrl || "";

                if (imageUrl) {
                    // 3. Update PostgreSQL
                    await client.query(
                        'UPDATE receipts SET image_url = $1 WHERE receipt_no = $2',
                        [imageUrl, row.receipt_no]
                    );
                    console.log(`✓ Receipt #${row.receipt_no} UPDATED -> ${imageUrl}\n`);
                } else {
                    console.error(`❌ Google Drive did not return a valid URL for Receipt #${row.receipt_no}\n`);
                }

                // Brief delay between requests
                await new Promise(res => setTimeout(res, 800));

            } catch (rowErr) {
                console.error(`❌ Error processing Receipt #${row.receipt_no}:`, rowErr.message);
            }
        }

        console.log("--------------------------------------------------");
        console.log("✓ Finished processing missing receipt images!");
        console.log("--------------------------------------------------");

    } catch (err) {
        console.error("Migration Error:", err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

processMissingImages();