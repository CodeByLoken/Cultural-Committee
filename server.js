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
app.get('/api/stats', async (req, res) => {
    try {
        const flat = req.query.flat ? `?flat=${encodeURIComponent(req.query.flat)}` : '';
        const response = await fetch(`${GOOGLE_SCRIPT_URL}${flat}`, { redirect: 'follow' });
        const rawText = await response.text();
        const data = JSON.parse(rawText);
        res.json(data);
    } catch (error) {
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));