require('dns').setDefaultResultOrder('ipv4first');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { getAmountInWords } = require('./services/numberToWords');
const { generateReceiptPDF } = require('./services/pdfService');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use(express.static('public'));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzLE686MbDnfe2rwnQa715tw99al8rMjAvpXeuH8WKrlN9xF3nH6DTez_klUNVUGY_o/exec';

// Get Dashboard Data & Search
app.get('/api/stats', async (req, res) => {
    try {
        const flatQuery = req.query.flat;

        if (flatQuery) {
            const pattern = `${flatQuery.toLowerCase()}%`;
            const searchRes = await pool.query(
                `SELECT receipt_no AS "receiptNo", date, name, flat, amount, whatsapp, 
                        collected_by AS "collectedBy", image_url AS "imageUrl" 
                 FROM receipts 
                 WHERE LOWER(flat) LIKE $1 
                 ORDER BY receipt_no DESC`,
                [pattern]
            );
            return res.json({ results: searchRes.rows });
        }

        const [collectionsRes, expensesRes, usersRes] = await Promise.all([
            pool.query('SELECT COALESCE(SUM(amount), 0) AS total_amount, COUNT(receipt_no) AS total_receipts, COALESCE(SUM(family_count), 0) AS total_members FROM receipts'),
            pool.query('SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses'),
            pool.query('SELECT name, pin, role FROM users ORDER BY id ASC')
        ]);

        const stats = collectionsRes.rows[0];
        const expenses = expensesRes.rows[0];

        res.json({
            totalAmount: Number(stats.total_amount),
            totalReceipts: Number(stats.total_receipts),
            totalMembers: Number(stats.total_members),
            totalExpenses: Number(expenses.total_expenses),
            users: usersRes.rows
        });

    } catch (error) {
        console.error("Stats API Error:", error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Analytics Route (with Cumulative Running Balance)
app.get('/api/analytics', async (req, res) => {
    try {
        const [dailyRes, buildingRes, paymentModeRes, expenseModeRes] = await Promise.all([
            pool.query(`
                WITH parsed_receipts AS (
                    SELECT 
                        CASE 
                            WHEN date ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN TO_DATE(date, 'DD/MM/YYYY')
                            WHEN date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN TO_DATE(date, 'YYYY-MM-DD')
                            ELSE NULL
                        END AS parsed_date,
                        amount,
                        receipt_no
                    FROM receipts
                ),
                parsed_expenses AS (
                    SELECT 
                        CASE 
                            WHEN date ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN TO_DATE(date, 'DD/MM/YYYY')
                            WHEN date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN TO_DATE(date, 'YYYY-MM-DD')
                            ELSE NULL
                        END AS parsed_date,
                        amount
                    FROM expenses
                ),
                daily_coll AS (
                    SELECT 
                        parsed_date, 
                        SUM(amount) AS total_collected, 
                        COUNT(receipt_no) AS receipt_count 
                    FROM parsed_receipts 
                    WHERE parsed_date IS NOT NULL 
                    GROUP BY parsed_date
                ),
                daily_exp AS (
                    SELECT 
                        parsed_date, 
                        SUM(amount) AS total_spent 
                    FROM parsed_expenses 
                    WHERE parsed_date IS NOT NULL 
                    GROUP BY parsed_date
                ),
                combined_daily AS (
                    SELECT 
                        COALESCE(c.parsed_date, e.parsed_date) AS parsed_date,
                        COALESCE(c.total_collected, 0) AS daily_collection,
                        COALESCE(c.receipt_count, 0) AS receipt_count,
                        COALESCE(e.total_spent, 0) AS daily_expense,
                        (COALESCE(c.total_collected, 0) - COALESCE(e.total_spent, 0)) AS net_daily
                    FROM daily_coll c
                    FULL OUTER JOIN daily_exp e ON c.parsed_date = e.parsed_date
                )
                SELECT 
                    TO_CHAR(parsed_date, 'DD/MM/YYYY') AS date,
                    receipt_count,
                    daily_collection,
                    daily_expense,
                    net_daily,
                    SUM(net_daily) OVER (ORDER BY parsed_date ASC) AS cumulative_balance
                FROM combined_daily
                ORDER BY parsed_date DESC
            `),
            pool.query(`
                WITH b_counts AS (
                    SELECT 
                        CASE 
                            WHEN LOWER(flat) LIKE 'a-%' THEN 'Building A'
                            WHEN LOWER(flat) LIKE 'b-%' THEN 'Building B'
                            WHEN LOWER(flat) LIKE 'c-%' THEN 'Building C'
                            WHEN LOWER(flat) LIKE 'd1-%' THEN 'Building D1'
                            WHEN LOWER(flat) LIKE 'd2-%' THEN 'Building D2'
                            WHEN LOWER(flat) LIKE 'e-%' THEN 'Building E'
                            WHEN LOWER(flat) LIKE 'f1-%' THEN 'Building F1'
                            WHEN LOWER(flat) LIKE 'maha%' THEN 'Mahaprasad Annadan'
                            WHEN Lower(flat) LIKE 'vendor-' THEN 'Vendors'
                            ELSE 'Other'
                        END AS building,
                        COUNT(DISTINCT LOWER(flat)) AS contributed_flats,
                        COUNT(receipt_no) AS total_receipts,
                        COALESCE(SUM(amount), 0) AS total_amount
                    FROM receipts
                    GROUP BY building
                )
                SELECT building, contributed_flats, total_receipts, total_amount FROM b_counts
                ORDER BY total_amount DESC
            `),
            pool.query(`
                SELECT 
                    payment_mode AS mode,
                    COUNT(receipt_no) AS total_receipts,
                    COALESCE(SUM(amount), 0) AS total_amount
                FROM receipts
                GROUP BY payment_mode
            `),
            pool.query(`
                SELECT 
                    COALESCE(expense_type, 'online') AS mode,
                    COALESCE(SUM(amount), 0) AS total_amount
                FROM expenses
                GROUP BY COALESCE(expense_type, 'online')
            `)
        ]);

        res.json({
            status: 'success',
            dailySummary: dailyRes.rows,
            buildingSummary: buildingRes.rows,
            paymentModeSummary: paymentModeRes.rows,
            expenseModeSummary: expenseModeRes.rows
        });

    } catch (error) {
        console.error("Analytics API Error:", error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/amount-words', (req, res) => {
    const { amount, lang } = req.query;
    const words = getAmountInWords(amount, lang || 'en');
    res.json({ words });
});

app.post('/api/save-receipt', async (req, res) => {
    const { name, whatsapp, flat, amount, familyCount, paymentMode, collectedBy, lang } = req.body;
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const amountWords = getAmountInWords(amount, lang);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const insertQuery = `
           INSERT INTO receipts (date, name, whatsapp, flat, amount, amount_words, family_count, payment_mode, collected_by, lang)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING receipt_no;
       `;
        const values = [today, name, whatsapp, flat, amount, amountWords, familyCount, paymentMode, collectedBy, lang || 'en'];
        const dbRes = await client.query(insertQuery, values);

        const receiptNo = dbRes.rows[0].receipt_no;
        await client.query('COMMIT');

        return res.json({
            status: 'success',
            receiptNo,
            today,
            amountWords,
            flat,
            name,
            amount,
            whatsapp,
            paymentMode,
            collectedBy,
            lang: lang || 'en'
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        if (client) client.release();
    }
});

app.post('/api/generate-receipt-image', async (req, res) => {
    const payload = req.body;
    try {
        const pdfResult = await generateReceiptPDF(payload);

        if (!pdfResult || !pdfResult.imageBase64) {
            throw new Error("Puppeteer returned empty image buffer.");
        }

        const driveRes = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'saveImage',
                receiptNo: payload.receiptNo,
                flat: payload.flat,
                imageBase64: pdfResult.imageBase64
            }),
            redirect: 'follow'
        });

        const driveText = await driveRes.text();
        const driveData = JSON.parse(driveText);
        const imageUrl = driveData.imageUrl || "";

        if (imageUrl) {
            await pool.query('UPDATE receipts SET image_url = $1 WHERE receipt_no = $2', [imageUrl, payload.receiptNo]);
            return res.json({ status: 'success', imageUrl });
        } else {
            throw new Error("Google Drive did not return a valid URL.");
        }

    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/save-expense', async (req, res) => {
    try {
        const { header, date, summary, vendor, amount, expenseType, createdBy } = req.body;
        const insertQuery = `
            INSERT INTO expenses (header, date, summary, vendor, amount, expense_type, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `;
        await pool.query(insertQuery, [header, date, summary, vendor, amount, expenseType || 'online', createdBy]);
        syncToGoogleSheetAsync({ action: 'saveExpense', header, date, summary, vendor, amount, expenseType, createdBy });
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/get-expenses', async (req, res) => {
    try {
        const result = await pool.query(`SELECT header, date, summary, vendor, amount, COALESCE(expense_type, 'online') AS "expenseType", created_by AS "createdBy" FROM expenses ORDER BY id DESC`);
        res.json({ expenses: result.rows });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

function syncToGoogleSheetAsync(payload) {
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(err => console.error("Async Sheet Sync Error:", err.message));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

require('./services/telegramBot');

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Event Registration Endpoint with Strict Deadline Enforcement
app.post('/api/register-event', async (req, res) => {
    try {
        const deadline = new Date('2026-09-16T12:00:00');
        if (new Date() >= deadline) {
            return res.status(400).json({ status: 'error', message: 'Registrations are closed.' });
        }

        const { building, flat, participantName, age, whatsapp, events, audioBase64, audioFileName, notes } = req.body;

        if (!building || !flat || !participantName || !age || !whatsapp || !events || events.length === 0) {
            return res.status(400).json({ status: 'error', message: 'All mandatory fields are required.' });
        }

        let audioFileUrl = null;

        if (audioBase64) {
            try {
                const driveRes = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'saveAudio',
                        participantName,
                        flat: `${building}-${flat}`,
                        fileName: audioFileName || 'dance_track.mp3',
                        fileBase64: audioBase64.replace(/^data:audio\/\w+;base64,/, '')
                    }),
                    redirect: 'follow'
                });
                const driveData = await driveRes.json();
                audioFileUrl = driveData.fileUrl || null;
            } catch (uploadErr) {
                console.error("Failed to upload audio to Drive:", uploadErr.message);
            }
        }

        const query = `
            INSERT INTO event_registrations (building, flat, participant_name, age, whatsapp, events, audio_file_url, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id;
        `;
        const values = [building, flat, participantName, parseInt(age, 10), whatsapp, events, audioFileUrl, notes || ''];
        const dbRes = await pool.query(query, values);

        res.json({ status: 'success', registrationId: dbRes.rows[0].id });
    } catch (err) {
        console.error("Event Registration Error:", err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/annadan/items', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, item_name, (total_needed - total_pledged) AS remaining_qty, unit, notes 
            FROM annadan_items 
            WHERE (total_needed - total_pledged) > 0 
            ORDER BY id ASC;
        `);
        res.json({ status: 'success', items: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/annadan/admin/items', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, item_name, total_needed, total_pledged, (total_needed - total_pledged) AS remaining_qty, unit, notes 
            FROM annadan_items 
            ORDER BY id ASC;
        `);
        res.json({ status: 'success', items: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/annadan/admin/update', async (req, res) => {
    try {
        const { itemId, totalNeeded, totalPledged, notes } = req.body;
        await pool.query(`
            UPDATE annadan_items 
            SET total_needed = COALESCE($1, total_needed), 
                total_pledged = COALESCE($2, total_pledged),
                notes = $3
            WHERE id = $4;
        `, [totalNeeded, totalPledged, notes || '', itemId]);

        res.json({ status: 'success', message: 'Annadan item updated successfully.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/annadan/admin/add', async (req, res) => {
    try {
        const { itemName, totalNeeded, unit, notes } = req.body;
        if (!itemName || !totalNeeded || !unit) {
            return res.status(400).json({ status: 'error', message: 'Item name, total needed, and unit are required.' });
        }

        await pool.query(`
            INSERT INTO annadan_items (item_name, total_needed, total_pledged, unit, notes)
            VALUES ($1, $2, 0, $3, $4)
            ON CONFLICT (item_name) DO UPDATE 
            SET total_needed = EXCLUDED.total_needed, 
                unit = EXCLUDED.unit, 
                notes = EXCLUDED.notes;
        `, [itemName.trim(), parseInt(totalNeeded, 10), unit.trim(), notes ? notes.trim() : '']);

        res.json({ status: 'success', message: 'New Annadan item added successfully.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/event-reports', async (req, res) => {
    try {
        const { eventName } = req.query;
        const countsRes = await pool.query(`
            SELECT unnest(events) AS event_name, COUNT(*) AS total_participants
            FROM event_registrations
            GROUP BY event_name
            ORDER BY total_participants DESC;
        `);

        let participants = [];
        if (eventName) {
            const listRes = await pool.query(`
                SELECT 
                    id,
                    TO_CHAR(created_at, 'DD/MM/YYYY HH12:MI AM') AS registered_on,
                    building,
                    flat,
                    participant_name AS "participantName",
                    age,
                    whatsapp,
                    audio_file_url AS "audioFileUrl",
                    notes
                FROM event_registrations
                WHERE $1 = ANY(events)
                ORDER BY id ASC;
            `, [eventName]);
            participants = listRes.rows;
        }

        res.json({
            status: 'success',
            eventCounts: countsRes.rows,
            participants
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/annadan', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'annadan.html'));
});

app.get('/annadan-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'annadan-admin.html'));
});