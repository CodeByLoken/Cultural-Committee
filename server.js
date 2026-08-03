const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path'); // <--- THIS WAS MISSING
const { getAmountInWords } = require('./services/numberToWords');
const { generateReceiptPDF } = require('./services/pdfService');



const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(express.static('public')); // Keeps checking the public folder if it exists
app.use('/css', express.static(path.join(__dirname, 'css'))); // Fallback for CSS
app.use('/js', express.static(path.join(__dirname, 'js'))); // Fallback for JS
app.use('/assets', express.static(path.join(__dirname, 'assets'))); // Fallback for Images

const { Pool } = require('pg');

// Connect to PostgreSQL Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for cloud hosted DBs
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzLE686MbDnfe2rwnQa715tw99al8rMjAvpXeuH8WKrlN9xF3nH6DTez_klUNVUGY_o/exec';

// Get Dashboard Data, Stats, and Users List
// --- ADD THIS CACHE VARIABLE RIGHT ABOVE THE STATS ROUTE ---
let statsCache = { data: null, lastFetch: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
// Get Dashboard Data, Stats, and Users List with Safety Fallbacks
app.get('/api/stats', async (req, res) => {
    try {
        const flatQuery = req.query.flat;

        // Search Receipts by Flat Number
        if (flatQuery) {
            const searchRes = await pool.query(
                `SELECT receipt_no AS "receiptNo", date, name, flat, amount, whatsapp, 
                        collected_by AS "collectedBy", image_url AS "imageUrl" 
                 FROM receipts 
                 WHERE LOWER(flat) = LOWER($1) 
                 ORDER BY receipt_no DESC`,
                [flatQuery]
            );
            return res.json({ results: searchRes.rows });
        }

        // Parallel Query Execution for Dashboard Metrics (~10ms)
        const [collectionsRes, expensesRes, usersRes] = await Promise.all([
            pool.query('SELECT COALESCE(SUM(amount), 0) AS total_amount, COUNT(receipt_no) AS total_receipts, COALESCE(SUM(family_count), 0) AS total_members FROM receipts'),
            pool.query('SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses'),
            pool.query('SELECT name, pin, role FROM users ORDER BY name ASC')
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

// Convert Amount to Words API
app.get('/api/amount-words', (req, res) => {
    const { amount, lang } = req.query;
    const words = getAmountInWords(amount, lang || 'en');
    res.json({ words });
});

// Save Receipt & Backend PDF / Image Generation
// Step 1: Save Receipt Data Only (20ms max)
app.post('/api/save-receipt', async (req, res) => {
    const { name, whatsapp, flat, amount, familyCount, paymentMode, collectedBy, lang } = req.body;
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const amountWords = getAmountInWords(amount, lang);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const insertQuery = `
            INSERT INTO receipts (date, name, whatsapp, flat, amount, amount_words, family_count, payment_mode, collected_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING receipt_no;
        `;
        const values = [today, name, whatsapp, flat, amount, amountWords, familyCount, paymentMode, collectedBy];
        const dbRes = await client.query(insertQuery, values);

        const receiptNo = dbRes.rows[0].receipt_no;
        await client.query('COMMIT');

        // Immediately respond to frontend!
        return res.json({
            status: 'success',
            receiptNo,
            today,
            amountWords,
            flat,
            name,
            amount,
            whatsapp
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Save Receipt Error:", error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        client.release();
    }
});

// Step 2: Dedicated Image Generation Endpoint
app.post('/api/generate-receipt-image', async (req, res) => {
    const { receiptNo, name, whatsapp, flat, amount, amountWords, familyCount, paymentMode, collectedBy, today, lang } = req.body;

    try {
        const pdfResult = await generateReceiptPDF({
            receiptNo, name, whatsapp, flat, amount, amountWords, familyCount, paymentMode, collectedBy, today, lang
        });

        let imageUrl = "";
        if (pdfResult && pdfResult.imageBase64) {
            const driveRes = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'saveImage', receiptNo, flat, imageBase64: pdfResult.imageBase64 }),
                redirect: 'follow'
            });
            const driveData = JSON.parse(await driveRes.text());
            imageUrl = driveData.imageUrl || "";

            if (imageUrl) {
                await pool.query('UPDATE receipts SET image_url = $1 WHERE receipt_no = $2', [imageUrl, receiptNo]);
            }
        }

        return res.json({ status: 'success', imageUrl });

    } catch (err) {
        console.error("Image generation error:", err.message);
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

// Save Expense Record (Admin Only)
app.post('/api/save-expense', async (req, res) => {
    try {
        const { header, date, summary, vendor, amount, createdBy } = req.body;

        const insertQuery = `
            INSERT INTO expenses (header, date, summary, vendor, amount, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id;
        `;
        await pool.query(insertQuery, [header, date, summary, vendor, amount, createdBy]);

        // Background sync to Google Sheets
        syncToGoogleSheetAsync({ action: 'saveExpense', header, date, summary, vendor, amount, createdBy });

        res.json({ status: 'success' });
    } catch (error) {
        console.error("Save Expense Error:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Fetch All Expenses List
app.get('/api/get-expenses', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT header, date, summary, vendor, amount, created_by AS "createdBy" 
             FROM expenses 
             ORDER BY id DESC`
        );
        res.json({ expenses: result.rows });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Background Sync Helper
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