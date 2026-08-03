const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');

// Your exact Neon connection string with connection pooling enabled
const connectionString = "postgresql://neondb_owner:npg_4aS3XGvWsijz@ep-falling-hill-az6l7swx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

function parseAmount(val) {
    if (!val) return 0;
    const cleanStr = val.toString().replace(/[^0-9.]/g, '');
    return parseFloat(cleanStr) || 0;
}

async function importLegacyData() {
    let client;
    try {
        client = await pool.connect();
        console.log("✓ Connected to Neon PostgreSQL successfully.");

        let importedCount = 0;
        let calculatedTotal = 0;
        const rows = [];

        // Parse CSV as raw positional array (0-indexed columns)
        fs.createReadStream('legacy_receipts.csv')
            .pipe(csv({ headers: false }))
            .on('data', (row) => rows.push(row))
            .on('end', async () => {
                // Remove header row if present
                if (rows.length > 0 && isNaN(parseAmount(rows[0]['5']))) {
                    rows.shift();
                }

                console.log(`Found ${rows.length} records in CSV to import.\n`);

                await client.query('BEGIN');

                for (const row of rows) {
                    /*
                      Column Index Mapping (0-based):
                      0: Timestamp (e.g. 8/2/2026 19:11:00)
                      1: Receipt No (e.g. PGR-1001)
                      2: Name
                      3: WhatsApp Number
                      4: Flat Number
                      5: Amount (e.g. 1500)
                      6: No of Family Members
                      7: Date of Collection
                      8: Payment Mode (labeled 'Date and Time of Collection' in header)
                      9: Google Drive Link (Image URL)
                      10: Year (Column K - SKIPPED)
                      11: User Name / Collected By (Column L)
                    */

                    const rawReceiptNo = row['1'] || '';
                    const receiptNoMatch = rawReceiptNo.match(/\d+/);
                    const receiptNo = receiptNoMatch ? parseInt(receiptNoMatch[0], 10) : null;

                    const name = row['2'] || '';
                    const whatsapp = row['3'] || '';
                    const flat = row['4'] || '';
                    const amount = parseAmount(row['5']);
                    const familyCount = parseInt(row['6'] || '1', 10) || 1;
                    const date = row['7'] || row['0'] || '';
                    const paymentMode = row['8'] || 'UPI';
                    const imageUrl = row['9'] || '';
                    const collectedBy = row['11'] || 'Lokendra Singh Parmar';
                    const amountWords = '';

                    calculatedTotal += amount;

                    if (receiptNo) {
                        const insertQuery = `
              INSERT INTO receipts (receipt_no, date, name, whatsapp, flat, amount, amount_words, family_count, payment_mode, collected_by, image_url)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (receipt_no) DO UPDATE SET
                date = EXCLUDED.date,
                name = EXCLUDED.name,
                whatsapp = EXCLUDED.whatsapp,
                flat = EXCLUDED.flat,
                amount = EXCLUDED.amount,
                family_count = EXCLUDED.family_count,
                payment_mode = EXCLUDED.payment_mode,
                collected_by = EXCLUDED.collected_by,
                image_url = EXCLUDED.image_url;
            `;
                        await client.query(insertQuery, [receiptNo, date, name, whatsapp, flat, amount, amountWords, familyCount, paymentMode, collectedBy, imageUrl]);
                    } else {
                        const insertQuery = `
              INSERT INTO receipts (date, name, whatsapp, flat, amount, amount_words, family_count, payment_mode, collected_by, image_url)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
            `;
                        await client.query(insertQuery, [date, name, whatsapp, flat, amount, amountWords, familyCount, paymentMode, collectedBy, imageUrl]);
                    }

                    importedCount++;
                }

                await client.query('COMMIT');
                console.log(`--------------------------------------------------`);
                console.log(`✓ Imported/Updated: ${importedCount} records`);
                console.log(`✓ Total Calculated Collection: ₹${calculatedTotal}`);
                console.log(`--------------------------------------------------`);

                // Synchronize sequence to highest receipt_no
                await client.query(`
          SELECT setval('receipts_receipt_no_seq', (SELECT COALESCE(MAX(receipt_no), 1) FROM receipts));
        `);
                console.log("✓ Sequence updated successfully.");

                client.release();
                process.exit(0);
            });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error("Migration Error:", error.message);
        if (client) client.release();
        process.exit(1);
    }
}

importLegacyData();