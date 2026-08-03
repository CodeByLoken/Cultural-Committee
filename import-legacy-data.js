const fs = require('fs');
const csv = require('csv-parser');
const { Pool } = require('pg');

// Hardcode your Neon Connection String directly here to avoid Windows CLI variable issues
const connectionString = "postgresql://neondb_owner:npg_4aS3XGvWsijz@ep-falling-hill-az6l7swx.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function importLegacyData() {
    const client = await pool.connect();
    let importedCount = 0;

    try {
        console.log("Starting migration of legacy records from CSV...");

        const rows = [];

        // 1. Read CSV File
        fs.createReadStream('legacy_receipts.csv')
            .pipe(csv())
            .on('data', (row) => rows.push(row))
            .on('end', async () => {
                console.log(`Found ${rows.length} records in CSV. Inserting into PostgreSQL...`);

                await client.query('BEGIN');

                for (const row of rows) {
                    const insertQuery = `
            INSERT INTO receipts (date, name, whatsapp, flat, amount, amount_words, family_count, payment_mode, collected_by, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
          `;

                    const values = [
                        row.date || '',
                        row.name || '',
                        row.whatsapp || '',
                        row.flat || '',
                        Number(row.amount) || 0,
                        row.amount_words || '',
                        Number(row.family_count) || 1,
                        row.payment_mode || 'Cash',
                        row.collected_by || 'Admin',
                        row.image_url || ''
                    ];

                    await client.query(insertQuery, values);
                    importedCount++;
                }

                await client.query('COMMIT');
                console.log(`✓ Successfully imported ${importedCount} records into PostgreSQL!`);

                // 2. Synchronize PostgreSQL's receipt_no auto-increment sequence
                await client.query(`
          SELECT setval('receipts_receipt_no_seq', (SELECT MAX(receipt_no) FROM receipts));
        `);
                console.log("✓ Updated receipt_no sequence counter to prevent duplicate primary key conflicts.");

                client.release();
                process.exit(0);
            });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Migration Error:", error.message);
        client.release();
        process.exit(1);
    }
}

importLegacyData();