let AUTHORIZED_USERS = {};
let loggedInUser = "";
let sessionTimer;
const TIMEOUT_DURATION = 90 * 60 * 1000; // 90 minutes in milliseconds
let userRole = "user";
let currentData = {};
let currentLang = "en";
let expensesList = [];

const i18n = {
    mr: {
        statAmount: "एकूण जमा वर्गणी", statReceipts: "एकूण पावत्या", statMembers: "एकूण कुटुंब सदस्य", statExpense: "एकूण खर्च",
        formTitle: "पावती माहिती भरा", nameLbl: "श्री / सौ. (पूर्ण नाव)", namePh: "उदा. लोकेंद्र सिंह परमार",
        waLbl: "व्हॉट्सॲप नंबर", waPh: "9876543210", flatLbl: "फ्लॅट नंबर", flatPh: "A-608",
        amtLbl: "वर्गणी रक्कम (₹)", amtPh: "1000", wordsLbl: "रक्कम अक्षरी (Amount in Words)",
        famLbl: "कुटुंब व्यक्ती संख्या", famPh: "4", modeLbl: "भरणा प्रकार",
        modeOptions: { UPI: "ऑनलाइन (UPI)", Cash: "रोख (Cash)" },
        btnSave: "पावती सेव्ह करा व PDF जनरेट करा",
        saveLoadingText: "⏳ पावती सेव्ह होत आहे...",
        savingStatusText: "माहिती सेव्ह होत आहे. कृपया वाट पहा...",
        saveSuccessMsg: "✓ पावती सेव्ह झाली! आता इमेज लिंक तयार होत आहे...",
        waLinkMsg: "🖼️ अधिकृत पावती व मंडळ कार्यक्रम इमेज पाहण्यासाठी येथे क्लिक करा:",
        tabReceipt: "📝 पावती नोंदवा", tabExpense: "💸 खर्च नोंदवा (Admin)", tabSearch: "🔎 पावती शोधा",
        expTitle: "💸 खर्च नोंदवा (Add New Expense)",
        expHeaderLbl: "१) खर्च प्रकार / कार्यक्रम (Category)",
        expDateLbl: "२) दिनांक (Date)",
        expVendorLbl: "३) दुकानदार / व्हेंडर (Vendor Name)",
        expSummaryLbl: "४) खर्चाचा तपशील (Description)",
        expAmtLbl: "५) रक्कम (Amount ₹)",
        expBtnSave: "खर्च सेव्ह करा (Save Expense)",
        expLedgerTitle: "📊 खर्चाचे विवरण (Expenses Ledger)",
        expHeaders: {
            "Ganesh Chaturthi Utsav": "गणेश चतुर्थी उत्सव",
            "15th August (Independence Day)": "१५ ऑगस्ट (स्वातंत्र्य दिन)",
            "Janmashtami (Dahi Handi)": "श्रीकृष्ण जन्माष्टमी",
            "Navratri Festival": "नवरात्री उत्सव",
            "26th January (Republic Day)": "२६ जानेवारी (प्रजासत्ताक दिन)",
            "Holi Festival": "होळी महोत्सव",
            "Common Expense": "Common Expense"
        },
        tableCols: { date: "दिनांक", category: "कार्यक्रम/प्रकार", summary: "तपशील", vendor: "व्हेंडर", amount: "रक्कम (₹)", action: "ॲक्शन" },
        waErr: "कृपया वैध १० अंकी व्हॉट्सॲप नंबर टाका.",
        waValid: "✓ वैध १० अंकी नंबर",
        flatErr: "फ्लॅट नंबरमध्ये अचूक एक '-' असणे आवश्यक आहे (उदा. A-608).",
        flatValid: "✓ वैध फ्लॅट नंबर"
    },
    hi: {
        statAmount: "कुल चंदा जमा", statReceipts: "कुल रसीदें", statMembers: "कुल परिवार सदस्य", statExpense: "कुल खर्च",
        formTitle: "रसीद जानकारी भरें", nameLbl: "श्री / श्रीमती (पूरा नाम)", namePh: "उदा. लोकेंद्र सिंह परमार",
        waLbl: "व्हाट्सएप नंबर", waPh: "9876543210", flatLbl: "फ्लैट नंबर", flatPh: "A-608",
        amtLbl: "चंदा राशि (₹)", amtPh: "1000", wordsLbl: "राशि शब्दों में (Amount in Words)",
        famLbl: "परिवार सदस्य संख्या", famPh: "4", modeLbl: "भुगतान का प्रकार",
        modeOptions: { UPI: "ऑनलाइन (UPI)", Cash: "नकद (Cash)" },
        btnSave: "रसीद सहेजें एवं जनरेट करें",
        saveLoadingText: "⏳ रसीद सहेजी जा रही है...",
        savingStatusText: "जानकारी सहेजी जा रही है। कृपया प्रतीक्षा करें...",
        saveSuccessMsg: "✓ रसीद सफलतापूर्वक सहेजी गई! लिंक तैयार हो रही है...",
        waLinkMsg: "🖼️ आधिकारिक रसीद एवं कार्यक्रम इमेज देखने के लिए यहाँ क्लिक करें:",
        tabReceipt: "📝 रसीद दर्ज करें", tabExpense: "💸 खर्च दर्ज करें (Admin)", tabSearch: "🔎 रसीद खोजें",
        expTitle: "💸 खर्च दर्ज करें (Add New Expense)",
        expHeaderLbl: "1) खर्च श्रेणी / कार्यक्रम (Category)",
        expDateLbl: "2) दिनांक (Date)",
        expVendorLbl: "3) विक्रेता / ठेकेदार (Vendor Name)",
        expSummaryLbl: "4) खर्च विवरण (Description)",
        expAmtLbl: "5) राशि (Amount ₹)",
        expBtnSave: "खर्च सहेजें (Save Expense)",
        expLedgerTitle: "📊 खर्च विवरण (Expenses Ledger)",
        expHeaders: {
            "Ganesh Chaturthi Utsav": "गणेश चतुर्थी उत्सव",
            "15th August (Independence Day)": "15 अगस्त (स्वतंत्रता दिवस)",
            "Janmashtami (Dahi Handi)": "श्रीकृष्ण जन्माष्टमी",
            "Navratri Festival": "नवरात्रि उत्सव",
            "26th January (Republic Day)": "26 जनवरी (गणतंत्र दिवस)",
            "Holi Festival": "होली उत्सव",
            "Common Expense": "Common Expense"
        },
        tableCols: { date: "दिनांक", category: "कार्यक्रम/श्रेणी", summary: "विवरण", vendor: "विक्रेता", amount: "राशि (₹)", action: "कार्रवाई" },
        waErr: "कृपया सही 10 अंकों का व्हाट्सएप नंबर दर्ज करें।",
        waValid: "✓ सही 10 अंकों का नंबर",
        flatErr: "फ्लैट नंबर में ठीक एक '-' होना अनिवार्य है (उदा. A-608)।",
        flatValid: "✓ सही फ्लैट नंबर"
    },
    en: {
        statAmount: "Total Collection", statReceipts: "Total Receipts", statMembers: "Total Family Members", statExpense: "Total Expenses",
        formTitle: "Fill Receipt Details", nameLbl: "Mr. / Mrs. (Full Name)", namePh: "e.g. Lokendra Singh Parmar",
        waLbl: "WhatsApp Number", waPh: "9876543210", flatLbl: "Flat No.", flatPh: "A-608",
        amtLbl: "Contribution Amount (₹)", amtPh: "1000", wordsLbl: "Amount in Words",
        famLbl: "No. of Family Members", famPh: "4", modeLbl: "Payment Mode",
        modeOptions: { UPI: "Online (UPI)", Cash: "Cash" },
        btnSave: "Save & Generate Receipt",
        saveLoadingText: "⏳ Saving Entry...",
        savingStatusText: "Saving entry to database. Please wait...",
        saveSuccessMsg: "✓ Entry Saved! Generating Drive image link...",
        waLinkMsg: "🖼️ Click here to view/download official receipt image/PDF:",
        tabReceipt: "📝 New Receipt", tabExpense: "💸 Manage Expenses (Admin)", tabSearch: "🔎 Search Receipts",
        expTitle: "💸 Record New Expense",
        expHeaderLbl: "1) Expense Category / Event",
        expDateLbl: "2) Expense Date",
        expVendorLbl: "3) Vendor / Payee Name",
        expSummaryLbl: "4) Expense Description / Summary",
        expAmtLbl: "5) Amount (₹)",
        expBtnSave: "Save Expense Record",
        expLedgerTitle: "📊 Category-Wise Expenses Ledger",
        expHeaders: {
            "Ganesh Chaturthi Utsav": "Ganesh Chaturthi Utsav",
            "15th August (Independence Day)": "15th August (Independence Day)",
            "Janmashtami (Dahi Handi)": "Janmashtami (Dahi Handi)",
            "Navratri Festival": "Navratri Festival",
            "26th January (Republic Day)": "26th January (Republic Day)",
            "Holi Festival": "Holi Festival",
            "Common Expense": "Common Expenses"
        },
        tableCols: { date: "Date", category: "Category / Event", summary: "Description", vendor: "Vendor", amount: "Amount (₹)", action: "Action" },
        waErr: "Please enter a valid 10-digit WhatsApp number.",
        waValid: "✓ Valid 10-digit number",
        flatErr: "Flat number must contain exactly one hyphen '-' (e.g. A-608).",
        flatValid: "✓ Valid Flat format"
    }
};

window.addEventListener('DOMContentLoaded', () => {
    const langSel = document.getElementById('langSelect');
    if (langSel) currentLang = langSel.value || 'en';

    changeLanguage();
    fetchStats();
    if (document.getElementById('expDate')) {
        document.getElementById('expDate').valueAsDate = new Date();
    }

    document.body.addEventListener('mousemove', resetSessionTimer);
    document.body.addEventListener('click', resetSessionTimer);
    document.body.addEventListener('keypress', resetSessionTimer);
});

function resetSessionTimer() {
    if (!loggedInUser) return;
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => {
        alert("Session expired due to 90 minutes of inactivity. Please login again.");
        handleLogout();
    }, TIMEOUT_DURATION);
}

async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('statAmount').innerText = '₹' + Number(data.totalAmount || 0).toLocaleString('en-IN');
        document.getElementById('statReceipts').innerText = data.totalReceipts || 0;
        document.getElementById('statMembers').innerText = data.totalMembers || 0;
        if (data.totalExpenses && document.getElementById('statExpenses')) {
            document.getElementById('statExpenses').innerText = '₹' + Number(data.totalExpenses || 0).toLocaleString('en-IN');
        }

        if (data.users && data.users.length > 0) {
            const userSelect = document.getElementById('loginUserSelect');
            userSelect.innerHTML = '<option value="" disabled selected>-- Select Representative --</option>';
            AUTHORIZED_USERS = {};
            data.users.forEach(u => {
                AUTHORIZED_USERS[u.name] = { pin: String(u.pin), role: u.role || (u.name.toLowerCase().includes('admin') ? 'admin' : 'user') };
                const opt = document.createElement('option');
                opt.value = u.name;
                opt.innerText = `${u.name}${u.name.toLowerCase().includes('admin') ? ' (Admin)' : ''}`;
                userSelect.appendChild(opt);
            });
        }
    } catch (err) { console.error('Error loading stats:', err); }
}

function handleLogin() {
    const user = document.getElementById('loginUserSelect').value;
    const pin = document.getElementById('loginPin').value.trim();
    const errDiv = document.getElementById('loginErr');

    if (AUTHORIZED_USERS[user] && AUTHORIZED_USERS[user].pin === pin) {
        loggedInUser = user;
        userRole = AUTHORIZED_USERS[user].role || 'user';

        document.getElementById('activeUserName').innerText = user;
        document.getElementById('loginOverlay').style.display = "none";
        document.getElementById('mainWrapper').style.display = "block";
        errDiv.style.display = "none";
        resetSessionTimer();

        const isAdmin = userRole === 'admin' || user.toLowerCase().includes('admin');
        document.getElementById('userRoleBadge').innerText = isAdmin ? 'Admin' : 'User';
        document.getElementById('userRoleBadge').style.background = isAdmin ? '#fb8500' : '#ffb703';

        // Toggle Admin-Only UI elements
        document.querySelectorAll('.admin-only').forEach(el => {
            if (isAdmin) {
                if (el.classList.contains('tab-content')) {
                    el.style.display = 'none';
                } else {
                    el.style.display = 'inline-block';
                }
            } else {
                el.style.display = 'none';
            }
        });

        if (document.getElementById('expenseStatCard')) {
            document.getElementById('expenseStatCard').style.display = 'flex';
        }

        resetForm();
        document.getElementById('loginPin').value = '';

        fetchStats();

        // Default tab selection based on role:
        // Admin defaults to 'create' (New Receipt)
        // Normal User defaults to 'analytics' (Analytics & Stats)
        if (isAdmin) {
            switchTab('create');
            fetchExpenses();
        } else {
            switchTab('analytics');
        }

    } else {
        errDiv.style.display = "block";
    }
}

function handleLogout() {
    loggedInUser = "";
    document.getElementById('mainWrapper').style.display = "none";
    document.getElementById('loginOverlay').style.display = "flex";
    clearTimeout(sessionTimer);
}

function switchTab(tabName) {
    const isAdmin = userRole === 'admin' || loggedInUser.toLowerCase().includes('admin');

    // Restrict Admin-Only tabs from non-admins
    if ((tabName === 'expense' || tabName === 'create') && !isAdmin) {
        console.warn("Access Denied: Admin privileges required.");
        return;
    }

    const tabs = ['create', 'analytics', 'expense', 'search'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}Btn`);
        const content = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (btn && content) {
            btn.classList.toggle('active', t === tabName);
            content.style.display = t === tabName ? 'block' : 'none';
        }
    });

    if (tabName === 'analytics') {
        fetchAnalyticsData();
    }
}

function setFormFreeze(isFrozen) {
    ['name', 'whatsapp', 'flat', 'amount', 'familyCount', 'paymentMode', 'saveBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = isFrozen;
    });
}

function validateWhatsAppRealtime() {
    const input = document.getElementById('whatsapp');
    const hint = document.getElementById('waValidationMsg');
    if (!input || !hint) return false;

    let val = input.value.replace(/[^0-9]/g, '').slice(0, 10);
    input.value = val;

    const t = i18n[currentLang] || i18n.en;

    if (val.length === 10) {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        hint.className = "input-hint success";
        hint.innerText = t.waValid;
        return true;
    } else {
        input.classList.remove('is-valid');
        if (val.length > 0) input.classList.add('is-invalid');
        hint.className = "input-hint error";
        hint.innerText = t.waErr;
        return false;
    }
}

function validateFlatRealtime() {
    const input = document.getElementById('flat');
    const hint = document.getElementById('flatValidationMsg');
    if (!input || !hint) return false;

    const val = input.value.trim();
    const hyphenCount = (val.match(/-/g) || []).length;
    const t = i18n[currentLang] || i18n.en;

    if (val.length > 0 && hyphenCount === 1) {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        hint.className = "input-hint success";
        hint.innerText = t.flatValid;
        return true;
    } else {
        input.classList.remove('is-valid');
        if (val.length > 0) input.classList.add('is-invalid');
        hint.className = "input-hint error";
        hint.innerText = t.flatErr;
        return false;
    }
}

function changeLanguage() {
    currentLang = document.getElementById('langSelect').value || 'en';
    const t = i18n[currentLang] || i18n.en;

    document.getElementById('lblStatAmount').innerText = t.statAmount;
    document.getElementById('lblStatReceipts').innerText = t.statReceipts;
    document.getElementById('lblStatMembers').innerText = t.statMembers;
    if (document.getElementById('lblStatExpense')) document.getElementById('lblStatExpense').innerText = t.statExpense;

    document.getElementById('tabCreateBtn').innerText = t.tabReceipt;
    if (document.getElementById('tabExpenseBtn')) document.getElementById('tabExpenseBtn').innerText = t.tabExpense;
    document.getElementById('tabSearchBtn').innerText = t.tabSearch;

    document.getElementById('lblFormTitle').innerText = t.formTitle;
    document.getElementById('lblFormName').innerText = t.nameLbl;
    document.getElementById('name').placeholder = t.namePh;
    document.getElementById('lblFormWhatsapp').innerText = t.waLbl;
    document.getElementById('whatsapp').placeholder = t.waPh;
    document.getElementById('lblFormFlat').innerText = t.flatLbl;
    document.getElementById('flat').placeholder = t.flatPh;
    document.getElementById('lblFormAmount').innerText = t.amtLbl;
    document.getElementById('amount').placeholder = t.amtPh;
    document.getElementById('lblFormWords').innerText = t.wordsLbl;
    document.getElementById('lblFormFamily').innerText = t.famLbl;
    document.getElementById('familyCount').placeholder = t.famPh;
    document.getElementById('lblFormMode').innerText = t.modeLbl;
    document.getElementById('saveBtnText').innerText = t.btnSave;

    const modeSelect = document.getElementById('paymentMode');
    if (modeSelect) {
        modeSelect.options[0].text = t.modeOptions.UPI;
        modeSelect.options[1].text = t.modeOptions.Cash;
    }

    if (document.getElementById('lblExpTitle')) document.getElementById('lblExpTitle').innerText = t.expTitle;
    if (document.getElementById('lblExpHeader')) document.getElementById('lblExpHeader').innerText = t.expHeaderLbl;
    if (document.getElementById('lblExpDate')) document.getElementById('lblExpDate').innerText = t.expDateLbl;
    if (document.getElementById('lblExpVendor')) document.getElementById('lblExpVendor').innerText = t.expVendorLbl;
    if (document.getElementById('lblExpSummary')) document.getElementById('lblExpSummary').innerText = t.expSummaryLbl;
    if (document.getElementById('lblExpAmt')) document.getElementById('lblExpAmt').innerText = t.expAmtLbl;
    if (document.getElementById('expSaveBtnText')) document.getElementById('expSaveBtnText').innerText = t.expBtnSave;
    if (document.getElementById('lblExpLedgerTitle')) document.getElementById('lblExpLedgerTitle').innerText = t.expLedgerTitle;

    const expHeaderSelect = document.getElementById('expHeader');
    if (expHeaderSelect) {
        for (let i = 0; i < expHeaderSelect.options.length; i++) {
            const optVal = expHeaderSelect.options[i].value;
            if (t.expHeaders[optVal]) {
                expHeaderSelect.options[i].text = t.expHeaders[optVal];
            }
        }
    }

    validateWhatsAppRealtime();
    validateFlatRealtime();
    handleAmountInput();
    if (expensesList.length > 0) renderExpensesTable();
}

async function handleAmountInput() {
    const amount = document.getElementById('amount').value;
    if (!amount || amount <= 0) {
        document.getElementById('amountWords').value = '';
        return;
    }
    try {
        const res = await fetch(`/api/amount-words?amount=${amount}&lang=${currentLang}`, { cache: 'no-store' });
        const data = await res.json();
        document.getElementById('amountWords').value = data.words;
    } catch (err) { }
}

async function generateAndSave() {
    const saveBtn = document.getElementById('saveBtn');
    const statusMsg = document.getElementById('statusMsg');
    const t = i18n[currentLang] || i18n.en;

    const name = document.getElementById('name').value.trim();
    const rawWhatsapp = document.getElementById('whatsapp').value.replace(/[^0-9]/g, '');
    const flat = document.getElementById('flat').value.trim();
    const amount = document.getElementById('amount').value.trim();
    const familyCount = document.getElementById('familyCount').value.trim() || "1";
    const paymentMode = document.getElementById('paymentMode').value;

    if (!validateWhatsAppRealtime()) {
        document.getElementById('whatsapp').focus();
        return;
    }

    if (!validateFlatRealtime()) {
        document.getElementById('flat').focus();
        return;
    }

    setFormFreeze(true);
    document.getElementById('saveBtnText').innerText = t.saveLoadingText;
    statusMsg.className = "status-msg";
    statusMsg.innerText = t.savingStatusText;

    const payload = {
        name,
        whatsapp: rawWhatsapp,
        flat,
        amount,
        familyCount,
        paymentMode,
        collectedBy: loggedInUser || "Lokendra Singh Parmar",
        lang: currentLang
    };

    try {
        const res = await fetch('/api/save-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.status === 'success') {
            currentData = { ...payload, ...result };

            document.getElementById('resReceiptNo').innerText = result.receiptNo;
            document.getElementById('resName').innerText = payload.name;
            document.getElementById('actionBox').style.display = 'block';

            statusMsg.className = "status-msg status-success";
            statusMsg.innerText = t.saveSuccessMsg;
            fetchStats();

            await triggerReceiptImageGeneration(currentData);

        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        statusMsg.className = "status-msg status-error";
        statusMsg.innerText = "Error saving receipt: " + err.message;
        setFormFreeze(false);
        document.getElementById('saveBtnText').innerText = t.btnSave;
    }
}

async function triggerReceiptImageGeneration(receiptData) {
    const waBtn = document.getElementById('waBtn');
    const viewPdfBtn = document.getElementById('viewPdfBtn');

    if (waBtn) {
        waBtn.disabled = true;
        waBtn.style.opacity = '0.5';
        waBtn.style.cursor = 'not-allowed';
        waBtn.innerHTML = `⏳ Generating Receipt Image Link...`;
    }
    if (viewPdfBtn) {
        viewPdfBtn.style.display = 'none';
    }

    try {
        const imgRes = await fetch('/api/generate-receipt-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(receiptData)
        });

        const imgData = await imgRes.json();

        if (imgData.status === 'success' && imgData.imageUrl) {
            currentData.imageUrl = imgData.imageUrl;

            if (viewPdfBtn) {
                viewPdfBtn.href = imgData.imageUrl;
                viewPdfBtn.style.display = 'inline-flex';
            }

            if (waBtn) {
                waBtn.disabled = false;
                waBtn.style.opacity = '1';
                waBtn.style.cursor = 'pointer';
                waBtn.innerHTML = `💬 Send WhatsApp Receipt Link`;
            }
        } else {
            throw new Error(imgData.message || "Failed to generate image URL");
        }
    } catch (err) {
        console.error("Image generation error:", err.message);

        if (waBtn) {
            waBtn.disabled = true;
            waBtn.style.opacity = '0.5';
            waBtn.style.cursor = 'not-allowed';
            waBtn.innerHTML = `⚠️ Image Generation Failed (Try Resend from Search)`;
        }
    } finally {
        document.getElementById('saveBtnText').innerText = i18n[currentLang]?.btnSave || "Save & Generate Receipt";
    }
}

function sendWhatsApp() {
    const t = i18n[currentLang] || i18n.en;

    let text = `*${currentLang === 'en' ? 'PURVANCHAL GANESHOTSAV MANDAL' : (currentLang === 'hi' ? 'पूर्वांचल गणेशोत्सव मंडल' : 'पूर्वांचल गणेशोत्सव मंडळ')}*\n` +
        `*${currentLang === 'en' ? 'DONATION RECEIPT • YEAR : 2026' : (currentLang === 'hi' ? 'दान / चंदा रसीद • वर्ष २०२६' : 'देणगी / वर्गणी पावती • वर्ष २०२६')}*\n` +
        `----------------------------------\n` +
        `*Receipt No:* ${currentData.receiptNo}\n` +
        `*Date:* ${currentData.today}\n` +
        `*Name:* ${currentData.name}\n` +
        `*Flat No:* ${currentData.flat}\n` +
        `*Amount:* ₹${currentData.amount}/- (${currentData.amountWords})\n` +
        `*Representative:* ${currentData.collectedBy}\n` +
        `----------------------------------\n`;

    if (currentData.imageUrl && currentData.imageUrl !== 'undefined' && currentData.imageUrl.trim() !== '') {
        text += `${t.waLinkMsg}\n${currentData.imageUrl}\n\n`;
    }

    text += `Thank you for your valuable support! 🌺`;

    const formattedWa = currentData.whatsapp.length === 10 ? '91' + currentData.whatsapp : currentData.whatsapp;
    window.open(`https://wa.me/${formattedWa}?text=${encodeURIComponent(text)}`, '_blank');
}

function resendWA(receiptNo, date, name, flat, amount, collectedBy, whatsapp, imageUrl) {
    const t = i18n[currentLang] || i18n.en;

    let text = `*${currentLang === 'en' ? 'PURVANCHAL GANESHOTSAV MANDAL' : (currentLang === 'hi' ? 'पूर्वांचल गणेशोत्सव मंडल' : 'पूर्वांचल गणेशोत्सव मंडळ')}*\n` +
        `*${currentLang === 'en' ? 'DONATION RECEIPT • YEAR : 2026' : (currentLang === 'hi' ? 'दान / चंदा रसीद • वर्ष २०२६' : 'देणगी / वर्गणी पावती • वर्ष २०२६')}*\n` +
        `----------------------------------\n` +
        `*Receipt No:* ${receiptNo}\n` +
        `*Date:* ${date}\n` +
        `*Name:* ${name}\n` +
        `*Flat No:* ${flat}\n` +
        `*Amount:* ₹${amount}/-\n` +
        `*Representative:* ${collectedBy}\n` +
        `----------------------------------\n`;

    if (imageUrl && imageUrl !== 'undefined' && imageUrl !== 'null' && imageUrl.trim() !== '') {
        text += `${t.waLinkMsg}\n${imageUrl}\n\n`;
    }

    text += `Thank you for your support !! 🌺`;

    const formattedWa = whatsapp.replace(/[^0-9]/g, '');
    const finalWa = formattedWa.length === 10 ? '91' + formattedWa : formattedWa;
    window.open(`https://wa.me/${finalWa}?text=${encodeURIComponent(text)}`, '_blank');
}

function resetForm() {
    ['name', 'whatsapp', 'flat', 'amount', 'amountWords', 'familyCount'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('actionBox').style.display = 'none';
    document.getElementById('statusMsg').innerText = '';
    document.getElementById('waValidationMsg').innerText = '';
    document.getElementById('flatValidationMsg').innerText = '';
    document.getElementById('whatsapp').className = '';
    document.getElementById('flat').className = '';
    setFormFreeze(false);
}

/* EXPENSES MODULE API & LOGIC */
async function saveExpense() {
    const btn = document.getElementById('expSaveBtn');
    const btnText = document.getElementById('expSaveBtnText');
    const msg = document.getElementById('expStatusMsg');

    btn.disabled = true;
    btn.style.opacity = "0.6";
    const originalButtonText = btnText.innerText;
    btnText.innerText = "⏳ Saving Expense... Please Wait...";

    const payload = {
        header: document.getElementById('expHeader').value,
        date: document.getElementById('expDate').value,
        summary: document.getElementById('expSummary').value.trim(),
        vendor: document.getElementById('expVendor').value.trim(),
        amount: document.getElementById('expAmount').value.trim(),
        createdBy: loggedInUser
    };

    try {
        const res = await fetch('/api/save-expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
            msg.className = "status-msg status-success";
            msg.innerText = "✓ Expense recorded successfully!";

            document.getElementById('expSummary').value = '';
            document.getElementById('expVendor').value = '';
            document.getElementById('expAmount').value = '';

            fetchExpenses();
            fetchStats();
        } else {
            throw new Error(data.message);
        }
    } catch (err) {
        msg.className = "status-msg status-error";
        msg.innerText = "Error saving expense: " + err.message;
    } finally {
        btn.disabled = false;
        btn.style.opacity = "1";
        btnText.innerText = originalButtonText;
    }
}

async function fetchExpenses() {
    const container = document.getElementById('groupedExpensesContainer');
    try {
        const res = await fetch('/api/get-expenses', { cache: 'no-store' });
        const data = await res.json();
        if (data.expenses) {
            expensesList = data.expenses;
            renderExpensesTable();
        }
    } catch (err) {
        if (container) container.innerHTML = '<p class="center-text">No expense records found.</p>';
    }
}

function formatDateClean(dateStr) {
    if (!dateStr) return '-';

    // Normalize slashes to hyphens for uniform processing
    let cleanStr = String(dateStr).trim().replace(/\//g, '-');
    let parts = cleanStr.split('-');

    // Case 1: Already YYYY-MM-DD (e.g., 2026-08-02)
    if (parts.length === 3 && parts[0].length === 4) {
        const day = parts[2].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[0];
        return `${day}/${month}/${year}`;
    }

    // Case 2: Already DD-MM-YYYY or MM-DD-YYYY (e.g., 03-08-2026)
    if (parts.length === 3 && parts[2].length === 4) {
        const p1 = parts[0].padStart(2, '0');
        const p2 = parts[1].padStart(2, '0');
        const year = parts[2];

        // If first part is > 12, it's guaranteed to be DD-MM-YYYY
        if (Number(p1) > 12) {
            return `${p1}/${p2}/${year}`;
        }

        // Otherwise assume DD/MM/YYYY
        return `${p1}/${p2}/${year}`;
    }

    // Case 3: Fallback using JavaScript Date parser
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    return dateStr;
}

function renderExpensesTable() {
    const container = document.getElementById('groupedExpensesContainer');
    if (!container) return;

    if (expensesList.length === 0) {
        container.innerHTML = '<p class="center-text">No expenses recorded yet.</p>';
        document.getElementById('tableTotalExpense').innerText = '₹0';
        if (document.getElementById('statExpenses')) {
            document.getElementById('statExpenses').innerText = '₹0';
        }
        return;
    }

    const t = i18n[currentLang] || i18n.en;

    const grouped = {};
    let overallTotal = 0;

    expensesList.forEach(item => {
        const headerKey = item.header || "Common Expense";
        if (!grouped[headerKey]) grouped[headerKey] = [];
        grouped[headerKey].push(item);
        overallTotal += Number(item.amount) || 0;
    });

    document.getElementById('tableTotalExpense').innerText = `₹${overallTotal.toLocaleString('en-IN')}`;
    if (document.getElementById('statExpenses')) {
        document.getElementById('statExpenses').innerText = `₹${overallTotal.toLocaleString('en-IN')}`;
    }

    let html = '';

    const svgGanesh = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="28" height="28" style="vertical-align: middle;"><g fill="none" stroke="#c1121f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M 50 10 L 40 25 L 60 25 Z" fill="#ffb703" stroke="#c1121f"/><path d="M 38 25 Q 50 18 62 25" stroke="#c1121f" stroke-width="2.5"/><circle cx="50" cy="18" r="2.5" fill="#c1121f"/><path d="M 38 32 C 15 25 15 52 38 52" fill="#fffdf5"/><path d="M 62 32 C 85 25 85 52 62 52" fill="#fffdf5"/><path d="M 38 32 Q 50 35 62 32 C 62 48 55 58 52 68 C 50 75 42 78 40 73 C 38 68 46 64 47 58 C 48 52 38 48 38 32 Z" fill="#fffdf5"/><path d="M 46 34 L 54 34 M 45 37 L 55 37 M 47 40 L 53 40" stroke="#c1121f" stroke-width="2"/><circle cx="50" cy="43" r="1.5" fill="#ffb703" stroke="none"/><circle cx="39" cy="71" r="3.5" fill="#ffb703" stroke="#c1121f" stroke-width="1.5"/></g></svg>`;
    const svgFlag = `<svg viewBox="0 0 36 24" width="28" height="20" style="vertical-align: middle;"><rect width="36" height="8" fill="#FF9933"/><rect y="8" width="36" height="8" fill="#FFFFFF"/><rect y="16" width="36" height="8" fill="#138808"/><circle cx="18" cy="12" r="3" fill="none" stroke="#000080" stroke-width="0.8"/></svg>`;
    const svgMatki = `<svg viewBox="0 0 36 36" width="28" height="28" style="vertical-align: middle;"><path d="M 8 14 C 8 30 28 30 28 14 C 28 10 8 10 8 14 Z" fill="#fb8500" stroke="#780000" stroke-width="2"/><ellipse cx="18" cy="11" rx="9" ry="3" fill="#ffea00"/><path d="M 14 8 Q 18 2 22 8" stroke="#2a9d8f" stroke-width="2" fill="none"/></svg>`;
    const svgDandiya = `<svg viewBox="0 0 36 36" width="28" height="28" style="vertical-align: middle;"><line x1="6" y1="30" x2="30" y2="6" stroke="#c1121f" stroke-width="4" stroke-linecap="round"/><line x1="6" y1="6" x2="30" y2="30" stroke="#ffb703" stroke-width="4" stroke-linecap="round"/><circle cx="18" cy="18" r="4" fill="#2a9d8f"/></svg>`;
    const svgChakra = `<svg viewBox="0 0 36 36" width="28" height="28" style="vertical-align: middle;"><circle cx="18" cy="18" r="14" fill="none" stroke="#003049" stroke-width="2.5"/><circle cx="18" cy="18" r="2.5" fill="#003049"/><path d="M 18 4 L 18 32 M 4 18 L 32 18 M 8 8 L 28 28 M 8 28 L 28 8" stroke="#003049" stroke-width="1.2"/></svg>`;
    const svgHoli = `<svg viewBox="0 0 36 36" width="28" height="28" style="vertical-align: middle;"><path d="M 4 22 C 4 30 16 30 16 22 Z" fill="#e63946"/><path d="M 20 22 C 20 30 32 30 32 22 Z" fill="#ffb703"/><path d="M 12 12 C 12 20 24 20 24 12 Z" fill="#2a9d8f"/></svg>`;

    const icons = {
        "Ganesh Chaturthi Utsav": svgGanesh,
        "15th August (Independence Day)": svgFlag,
        "Janmashtami (Dahi Handi)": svgMatki,
        "Navratri Festival": svgDandiya,
        "26th January (Republic Day)": svgChakra,
        "Holi Festival": svgHoli,
        "Common Expense": "📦"
    };

    for (const category in grouped) {
        const items = grouped[category];
        const categoryTitle = t.expHeaders[category] || category;
        const categoryIcon = icons[category] || "📦";

        let subtotal = 0;

        html += `
      <div class="category-expense-card">
        <div class="category-header">
          <div class="category-title">
            <span class="cat-icon">${categoryIcon}</span>
            <h4>${categoryTitle}</h4>
          </div>
          <button class="btn-print-sm" onclick="printCategoryTable('${category.replace(/'/g, "\\'")}')">🖨️ Print Statement</button>
        </div>

        <div class="table-wrapper">
          <table class="data-table" id="table-${category.replace(/[^a-zA-Z0-9]/g, '')}">
            <thead>
              <tr>
                <th style="width: 15%;">${t.tableCols.date}</th>
                <th style="width: 40%;">${t.tableCols.summary}</th>
                <th style="width: 25%;">${t.tableCols.vendor}</th>
                <th style="width: 20%;">${t.tableCols.amount}</th>
              </tr>
            </thead>
            <tbody>`;

        items.forEach(row => {
            const amt = Number(row.amount) || 0;
            subtotal += amt;
            html += `<tr>
        <td class="nowrap">${formatDateClean(row.date)}</td>
        <td>${row.summary}</td>
        <td>${row.vendor}</td>
        <td><strong>₹${amt.toLocaleString('en-IN')}</strong></td>
      </tr>`;
        });

        html += `
            </tbody>
            <tfoot>
              <tr class="subtotal-row">
                <td colspan="3" class="right-text"><strong>Subtotal (${categoryTitle}):</strong></td>
                <td><strong>₹${subtotal.toLocaleString('en-IN')}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
    }

    container.innerHTML = html;
}

function printCategoryTable(category) {
    const safeCat = category.replace(/[^a-zA-Z0-9]/g, '');
    const tableId = `table-${safeCat}`;
    const tableElement = document.getElementById(tableId);

    if (!tableElement) return;

    const cardElement = tableElement.closest('.category-expense-card');
    const contentToPrint = cardElement.outerHTML;
    const printWin = window.open('', '', 'width=900,height=700');
    const origin = window.location.origin;

    printWin.document.write(`
    <html>
      <head>
        <title>Print Statement - ${category}</title>
        <link rel="stylesheet" href="${origin}/css/style.css" />
        <style>
          body { 
            padding: 40px; 
            background: white; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          .btn-print-sm { display: none !important; }
          .category-expense-card { box-shadow: none !important; border: 2px solid #e2e8f0; }
        </style>
      </head>
      <body>
        ${contentToPrint}
        <script>
          window.onload = () => {
            setTimeout(() => {
                window.print();
                window.close();
            }, 500);
          };
        </script>
      </body>
    </html>
  `);

    printWin.document.close();
}

function printExpenseStatement() {
    window.print();
}

async function searchRecords() {
    const query = document.getElementById('searchFlat').value.trim();
    const container = document.getElementById('searchResults');

    if (!query) {
        container.innerHTML = `<p class="placeholder-text">Enter flat number above to search...</p>`;
        return;
    }

    container.innerHTML = `<p style="color:#666;">Searching...</p>`;
    try {
        const res = await fetch(`/api/stats?flat=${encodeURIComponent(query)}`);
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
            container.innerHTML = `<p style="color:#c1121f;">No records found.</p>`;
            return;
        }

        let html = `<table class="data-table"><thead><tr><th>Date</th><th>#</th><th>Name</th><th>Flat</th><th>Amount</th><th>Representative</th><th>Action</th></tr></thead><tbody>`;
        data.results.forEach(row => {
            const safeName = (row.name || '').replace(/'/g, "\\'");
            const safeFlat = (row.flat || '').replace(/'/g, "\\'");
            const safeCollector = (row.collectedBy || '').replace(/'/g, "\\'");
            const safeImgUrl = (row.imageUrl || '').replace(/'/g, "\\'");

            html += `<tr>
        <td class="nowrap">${formatDateClean(row.date)}</td>
        <td>${row.receiptNo}</td>
        <td>${row.name}</td>
        <td>${row.flat}</td>
        <td><strong>₹${Number(row.amount).toLocaleString('en-IN')}</strong></td>
        <td>${row.collectedBy || '-'}</td>
        <td><button style="background:#25D366; color:white; border:none; padding:6px 10px; border-radius:6px; font-weight:bold; cursor:pointer;" onclick="resendWA('${row.receiptNo}', '${formatDateClean(row.date)}', '${safeName}', '${safeFlat}', '${row.amount}', '${safeCollector}', '${row.whatsapp}', '${safeImgUrl}')">Resend WA</button></td>
      </tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) { container.innerHTML = '<p style="color:#c1121f;">Error searching records.</p>'; }
}

async function fetchAnalyticsData() {
    const bContainer = document.getElementById('buildingStatsContainer');
    const pContainer = document.getElementById('paymentModeStatsContainer');
    const tbody = document.getElementById('dailyLedgerTbody');

    const TOTAL_FLATS_MAP = {
        'Building A': 110,
        'Building B': 166,
        'Building C': 166,
        'Building D1': 76,
        'Building D2': 76,
        'Building E': 110,
        'Building F1': 42
    };

    try {
        const res = await fetch('/api/analytics', { cache: 'no-store' });
        const data = await res.json();

        if (data.status !== 'success') return;

        // 1. Render Building / Tower Stats with Participation Bar
        if (data.buildingSummary && data.buildingSummary.length > 0) {
            // Sort buildings alphabetically (Building A, B, C, D1, D2, E, F1)
            data.buildingSummary.sort((a, b) =>
                (a.building || '').localeCompare(b.building || '', undefined, { numeric: true, sensitivity: 'base' })
            );

            let bHtml = '';
            data.buildingSummary.forEach(b => {
                const totalCapacity = TOTAL_FLATS_MAP[b.building] || 0;
                const contributed = Number(b.contributed_flats) || 0;
                const percentage = totalCapacity > 0 ? ((contributed / totalCapacity) * 100).toFixed(1) : 0;

                bHtml += `
                    <div class="stat-pill-box">
                        <div class="b-name">${b.building}</div>
                        <div class="b-amount">₹${Number(b.total_amount).toLocaleString('en-IN')}</div>
                        <div class="b-count">${b.total_receipts} Receipts</div>
                        ${totalCapacity > 0 ? `
                            <div class="participation-bar-container">
                                <div class="participation-text">
                                    <span>Participation:</span> 
                                    <strong>${contributed}/${totalCapacity} (${percentage}%)</strong>
                                </div>
                                <div class="progress-bar-bg">
                                    <div class="progress-bar-fill" style="width: ${Math.min(percentage, 100)}%;"></div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            bContainer.innerHTML = bHtml;
        }

        // 2. Render Payment Mode Summary
        if (data.paymentModeSummary && data.paymentModeSummary.length > 0) {
            let pHtml = '<div class="payment-mode-flex">';
            data.paymentModeSummary.forEach(p => {
                const icon = p.mode.toLowerCase().includes('cash') ? '💵' : '📱';
                pHtml += `
                    <div class="payment-mode-pill">
                        <span class="p-icon">${icon}</span>
                        <div>
                            <strong>${p.mode}:</strong> ₹${Number(p.total_amount).toLocaleString('en-IN')}
                            <small>(${p.total_receipts} txns)</small>
                        </div>
                    </div>
                `;
            });
            pHtml += '</div>';
            pContainer.innerHTML = pHtml;
        }

        // 3. Render Daily Cash Flow Table
        if (data.dailySummary && data.dailySummary.length > 0) {
            let dHtml = '';
            data.dailySummary.forEach(row => {
                const coll = Number(row.daily_collection);
                const exp = Number(row.daily_expense);
                const net = Number(row.net_balance);
                const netClass = net >= 0 ? 'color: #2a9d8f; font-weight: bold;' : 'color: #c1121f; font-weight: bold;';

                dHtml += `
                    <tr>
                        <td class="nowrap">${formatDateClean(row.date)}</td>
                        <td>${row.receipt_count}</td>
                        <td style="color: #2a9d8f; font-weight: bold;">+ ₹${coll.toLocaleString('en-IN')}</td>
                        <td style="color: #c1121f; font-weight: bold;">- ₹${exp.toLocaleString('en-IN')}</td>
                        <td style="${netClass}">₹${net.toLocaleString('en-IN')}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = dHtml;
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="center-text">No daily records found.</td></tr>';
        }

    } catch (err) {
        console.error("Error loading analytics:", err);
    }
}