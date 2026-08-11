require('dns').setDefaultResultOrder('ipv4first');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { getAmountInWords } = require('./services/numberToWords');
const { generateReceiptPDF } = require('./services/pdfService');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

// Analytics Route (Updated with Available Balance Breakdown)
app.get('/api/analytics', async (req, res) => {
    try {
        const [dailyRes, buildingRes, paymentModeRes, expenseModeRes] = await Promise.all([
            // 1. Date-Wise Daily Cash Flow
            pool.query(`
                WITH daily_coll AS (
                    SELECT date, SUM(amount) AS total_collected, COUNT(receipt_no) AS receipt_count 
                    FROM receipts GROUP BY date
                ),
                daily_exp AS (
                    SELECT date, SUM(amount) AS total_spent 
                    FROM expenses GROUP BY date
                )
                SELECT 
                    COALESCE(c.date, e.date) AS date,
                    COALESCE(c.total_collected, 0) AS daily_collection,
                    COALESCE(c.receipt_count, 0) AS receipt_count,
                    COALESCE(e.total_spent, 0) AS daily_expense,
                    (COALESCE(c.total_collected, 0) - COALESCE(e.total_spent, 0)) AS net_balance
                FROM daily_coll c
                FULL OUTER JOIN daily_exp e ON c.date = e.date
                ORDER BY date DESC
            `),

            // 2. Building / Tower-Wise Breakdown with Unique Contributed Flats
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

            // 3. Payment Mode Split (Collections)
            pool.query(`
                SELECT 
                    payment_mode AS mode,
                    COUNT(receipt_no) AS total_receipts,
                    COALESCE(SUM(amount), 0) AS total_amount
                FROM receipts
                GROUP BY payment_mode
            `),

            // 4. Expense Mode Split
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

// Convert Amount to Words API
app.get('/api/amount-words', (req, res) => {
    const { amount, lang } = req.query;
    const words = getAmountInWords(amount, lang || 'en');
    res.json({ words });
});

// Save Receipt API
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

        console.log(`[DB SUCCESS] Receipt #${receiptNo} created for ${name} (${flat}) [Lang: ${lang || 'en'}]`);

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
        console.error("[DB ERROR] Save Receipt failed:", error.message);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        if (client) client.release();
    }
});

// Generate Image Endpoint
app.post('/api/generate-receipt-image', async (req, res) => {
    const payload = req.body;
    console.log(`[IMAGE START] Generating receipt image for #${payload.receiptNo}...`);

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
        console.error(`[IMAGE ERROR] Receipt #${payload.receiptNo} failed:`, err.message);
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

// Expenses Routes (Updated with expense_type)
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