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

        // 1. Search query (Flat Search) - Bypass cache
        if (flatQuery) {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?flat=${encodeURIComponent(flatQuery)}`, { redirect: 'follow' });
            const rawText = await response.text();
            return res.json(JSON.parse(rawText));
        }

        // 2. Return fresh cached data if available (under 5 mins old)
        if (statsCache.data && (Date.now() - statsCache.lastFetch < CACHE_TTL)) {
            return res.json(statsCache.data);
        }

        // 3. Fetch from Google Apps Script
        const response = await fetch(GOOGLE_SCRIPT_URL, { redirect: 'follow' });
        const rawText = await response.text();

        // Safety Check: Make sure Google returned valid JSON
        if (rawText && rawText.trim().startsWith('{')) {
            const data = JSON.parse(rawText);
            statsCache = { data, lastFetch: Date.now() }; // Update Cache
            return res.json(data);
        }

        // 4. FALLBACK: If Google Apps Script fails or returns empty, serve old cache instead of hanging!
        if (statsCache.data) {
            console.warn("Google Apps Script response invalid, serving stale cache fallback.");
            return res.json(statsCache.data);
        }

        throw new Error("Invalid response received from Google Apps Script.");

    } catch (error) {
        console.error("Stats API Error:", error.message);

        // Fallback: If cache exists, return it so login screen doesn't break
        if (statsCache.data) {
            return res.json(statsCache.data);
        }

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
app.post('/api/save-receipt', async (req, res) => {
    try {
        const { name, whatsapp, flat, amount, familyCount, paymentMode, collectedBy, lang } = req.body;
        const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const amountWords = getAmountInWords(amount, lang);

        let receiptNo = "";

        try {
            const sheetRes = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'saveEntry', name, whatsapp, flat, amount, amountWords, familyCount, paymentMode, collectedBy, today }),
                redirect: 'follow'
            });
            const rawText = await sheetRes.text();
            const sheetData = JSON.parse(rawText);
            if (sheetData.status === 'success') {
                receiptNo = sheetData.receiptNo;
                statsCache.data = null;
            }
        } catch (e) {
            console.warn("POST saveEntry notice, attempting GET query parameter fallback...");
        }

        if (!receiptNo) {
            const queryParams = new URLSearchParams({
                action: 'saveEntry',
                name, whatsapp, flat, amount, familyCount, paymentMode, collectedBy, today
            }).toString();

            const fallbackRes = await fetch(`${GOOGLE_SCRIPT_URL}?${queryParams}`, { redirect: 'follow' });
            const fallbackText = await fallbackRes.text();
            const fallbackData = JSON.parse(fallbackText);

            if (fallbackData.status === 'success') {
                receiptNo = fallbackData.receiptNo;
            } else {
                throw new Error(fallbackData.message || 'Sheet save entry failed');
            }
        }

        // Backend PDF/PNG Generation via Puppeteer
        let imageUrl = "";
        try {
            const pdfResult = await generateReceiptPDF({
                receiptNo, name, whatsapp, flat, amount, amountWords, familyCount, paymentMode, collectedBy, today, lang
            });

            if (pdfResult && pdfResult.imageBase64) {
                const imgRes = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'saveImage', receiptNo, flat, imageBase64: pdfResult.imageBase64 }),
                    redirect: 'follow'
                });
                const rawText = await imgRes.text();
                const imgData = JSON.parse(rawText);
                imageUrl = imgData.imageUrl || "";
            }
        } catch (pdfErr) {
            console.error("Backend PDF generation notice:", pdfErr);
        }

        res.json({
            status: 'success',
            receiptNo,
            today,
            amountWords,
            imageUrl
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Save Expense Record (Admin Only)
app.post('/api/save-expense', async (req, res) => {
    try {
        const { header, date, summary, vendor, amount, createdBy } = req.body;

        const queryParams = new URLSearchParams({
            action: 'saveExpense',
            header, date, summary, vendor, amount, createdBy
        }).toString();

        const response = await fetch(`${GOOGLE_SCRIPT_URL}?${queryParams}`, { redirect: 'follow' });
        const rawText = await response.text();
        const data = JSON.parse(rawText);
        if (data.status === 'success') {
            statsCache.data = null;
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Fetch All Expenses List
app.get('/api/get-expenses', async (req, res) => {
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getExpenses`, { redirect: 'follow' });
        const rawText = await response.text();
        const data = JSON.parse(rawText);
        res.json(data);
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});