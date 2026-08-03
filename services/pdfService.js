const puppeteer = require('puppeteer');

// 1. Ganesh Header SVG Icon
const ganeshHeaderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="45" height="45">
  <g fill="none" stroke="#c1121f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 50 10 L 40 25 L 60 25 Z" fill="#ffb703" stroke="#c1121f" />
    <path d="M 38 25 Q 50 18 62 25" stroke="#c1121f" stroke-width="2.5"/>
    <circle cx="50" cy="18" r="2.5" fill="#c1121f"/>
    <path d="M 38 32 C 15 25 15 52 38 52" fill="#fffdf5" />
    <path d="M 62 32 C 85 25 85 52 62 52" fill="#fffdf5" />
    <path d="M 38 32 Q 50 35 62 32 C 62 48 55 58 52 68 C 50 75 42 78 40 73 C 38 68 46 64 47 58 C 48 52 38 48 38 32 Z" fill="#fffdf5" />
    <path d="M 46 34 L 54 34 M 45 37 L 55 37 M 47 40 L 53 40" stroke="#c1121f" stroke-width="2" />
    <circle cx="50" cy="43" r="1.5" fill="#ffb703" stroke="none" />
    <circle cx="39" cy="71" r="3.5" fill="#ffb703" stroke="#c1121f" stroke-width="1.5" />
  </g>
</svg>`;

// 2. Event SVG Icons
const eventIcons = {
    flag: `<svg viewBox="0 0 36 24" width="32" height="22"><rect width="36" height="8" fill="#FF9933"/><rect y="8" width="36" height="8" fill="#FFFFFF"/><rect y="16" width="36" height="8" fill="#138808"/><circle cx="18" cy="12" r="3" fill="none" stroke="#000080" stroke-width="0.8"/></svg>`,
    matki: `<svg viewBox="0 0 36 36" width="28" height="28"><path d="M 8 14 C 8 30 28 30 28 14 C 28 10 8 10 8 14 Z" fill="#fb8500" stroke="#780000" stroke-width="2"/><ellipse cx="18" cy="11" rx="9" ry="3" fill="#ffea00"/><path d="M 14 8 Q 18 2 22 8" stroke="#2a9d8f" stroke-width="2" fill="none"/></svg>`,
    ganesh: ganeshHeaderSvg,
    dandiya: `<svg viewBox="0 0 36 36" width="28" height="28"><line x1="6" y1="30" x2="30" y2="6" stroke="#c1121f" stroke-width="4" stroke-linecap="round"/><line x1="6" y1="6" x2="30" y2="30" stroke="#ffb703" stroke-width="4" stroke-linecap="round"/><circle cx="18" cy="18" r="4" fill="#2a9d8f"/></svg>`,
    chakra: `<svg viewBox="0 0 36 36" width="28" height="28"><circle cx="18" cy="18" r="14" fill="none" stroke="#003049" stroke-width="2.5"/><circle cx="18" cy="18" r="2.5" fill="#003049"/><path d="M 18 4 L 18 32 M 4 18 L 32 18 M 8 8 L 28 28 M 8 28 L 28 8" stroke="#003049" stroke-width="1.2"/></svg>`,
    holi: `<svg viewBox="0 0 36 36" width="28" height="28"><path d="M 4 22 C 4 30 16 30 16 22 Z" fill="#e63946"/><path d="M 20 22 C 20 30 32 30 32 22 Z" fill="#ffb703"/><path d="M 12 12 C 12 20 24 20 24 12 Z" fill="#2a9d8f"/></svg>`
};

// 3. Translation Labels Dictionary
const labels = {
    mr: {
        title: "पूर्वांचल गणेशोत्सव मंडळ",
        address: "केसनंद, ता. हवेली, जि. पुणे ४१२ २०७",
        tag: "देणगी / वर्गणी पावती • वर्ष २०२६",
        receiptNo: "पा.नं.:",
        date: "दिनांक:",
        prefix: "श्री / सौ.",
        from: "यांकडून",
        body: "सोसायटीच्या सर्व सामूहिक उत्सवांसाठी देणगी / वर्गणी अक्षरी रुपये",
        received: "मिळाले.",
        symbol: "रु.",
        mode: "प्रकार:",
        thankYou: "आभारी आहोत ! धन्यवाद !!",
        subHeader: "॥ श्री गणेश प्रसन्न ॥",
        festTitle: "सोसायटीत साजरे होणारे सर्व सामूहिक उत्सव (२०२६ - २०२७)",
        festivals: [
            { name: "१५ ऑगस्ट (स्वातंत्र्य दिन)", iconKey: "flag" },
            { name: "श्रीकृष्ण जन्माष्टमी (दहीहंडी)", iconKey: "matki" },
            { name: "गणेश चतुर्थी उत्सव (१० दिवस)", iconKey: "ganesh" },
            { name: "नवरात्री उत्सव व गरबा दांडिया", iconKey: "dandiya" },
            { name: "२६ जानेवारी (प्रजासत्ताक दिन)", iconKey: "chakra" },
            { name: "होळी महोत्सव व रंगपंचमी", iconKey: "holi" }
        ]
    },
    hi: {
        title: "पूर्वांचल गणेशोत्सव मंडल",
        address: "केसनंद, ता. हवेली, जि. पुणे ४१२ २०७",
        tag: "दान / चंदा रसीद • वर्ष २०२६",
        receiptNo: "रसीद क्र.:",
        date: "दिनांक:",
        prefix: "श्री / श्रीमती",
        from: "से",
        body: "सोसायटी के सभी सामूहिक उत्सवों हेतु दान / चंदा राशि शब्दों में रुपये",
        received: "प्राप्त हुए।",
        symbol: "रु.",
        mode: "प्रकार:",
        thankYou: "आपका हार्दिक आभार ! धन्यवाद !!",
        subHeader: "॥ श्री गणेश प्रसन्न ॥",
        festTitle: "सोसायटी द्वारा आयोजित सभी सामूहिक उत्सव (२०२६ - २०२७)",
        festivals: [
            { name: "15 अगस्त (स्वतंत्रता दिवस)", iconKey: "flag" },
            { name: "श्रीकृष्ण जन्माष्टमी (दही हांडी)", iconKey: "matki" },
            { name: "गणेश चतुर्थी उत्सव (10 दिवस)", iconKey: "ganesh" },
            { name: "नवरात्रि उत्सव एवं गरबा", iconKey: "dandiya" },
            { name: "26 जनवरी (गणतंत्र दिवस)", iconKey: "chakra" },
            { name: "होली उत्सव एवं रंगपंचमी", iconKey: "holi" }
        ]
    },
    en: {
        title: "PURVANCHAL GANESHOTSAV MANDAL",
        address: "Kesnand, Tal. Haveli, Dist. Pune 412 207",
        tag: "DONATION RECEIPT • YEAR : 2026",
        receiptNo: "Receipt No:",
        date: "Date:",
        prefix: "Mr. / Mrs.",
        from: "received from",
        body: "a sum of Rupees",
        received: "towards all society organized festival contributions.",
        symbol: "Rs.",
        mode: "Mode:",
        thankYou: "Thank You Very Much!",
        subHeader: "॥ Shree Ganesh Prasanna ॥",
        festTitle: "SOCIETY ORGANISED FESTIVALS (YEAR 2026 - 2027)",
        festivals: [
            { name: "15th August (Independence Day)", iconKey: "flag" },
            { name: "Janmashtami (Dahi Handi)", iconKey: "matki" },
            { name: "Ganesh Chaturthi Utsav", iconKey: "ganesh" },
            { name: "Navratri Dandiya Nights", iconKey: "dandiya" },
            { name: "26th January (Republic Day)", iconKey: "chakra" },
            { name: "Holi Festival of Colors", iconKey: "holi" }
        ]
    }
};

async function generateReceiptPDF(data) {
    const lang = data.lang || 'mr';
    const t = labels[lang] || labels.mr;

    let receiptTextBody = "";
    if (lang === 'en') {
        receiptTextBody = `<p>Received with thanks from <strong>Mr. / Mrs. ${data.name}</strong> (Flat No: <strong>${data.flat}</strong>) a sum of Rupees <strong class="line">${data.amountWords}</strong> towards all society organized festival contributions.</p>`;
    } else {
        receiptTextBody = `
      <p>${t.prefix} <strong class="line">${data.name}</strong> (Flat: <strong>${data.flat}</strong>) ${t.from}</p>
      <p style="margin-top: 4px;">${t.body} <strong class="line">${data.amountWords}</strong> ${t.received}</p>
    `;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', 'Noto Sans Devanagari', 'Arial', sans-serif; }
        body { padding: 12px; background: #fff; width: 720px; margin: 0 auto; }
        #receiptContainer { width: 100%; background: #fff; padding: 4px; }
        .receipt-card { border: 3px solid #c1121f; border-radius: 14px; padding: 4px; background: #fffdf7; margin-bottom: 12px; }
        .receipt-inner { border: 2px dashed #fb8500; border-radius: 10px; padding: 12px 16px; }
        .garland { height: 6px; background: repeating-linear-gradient(90deg, #ffb703 0, #ffb703 15px, #c1121f 15px, #c1121f 30px); border-radius: 4px; margin-bottom: 8px; }
        .header { display: flex; align-items: center; gap: 12px; background: linear-gradient(135deg, #c1121f, #780000); color: white; padding: 10px 14px; border-radius: 8px; }
        .ganesh-box { background: white; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .header-text { flex: 1; text-align: center; }
        .sub-header { font-size: 0.72rem; color: #ffddd2; }
        .header-text h2 { font-size: 1.25rem; color: #ffea00; margin: 1px 0; }
        .header-text p { font-size: 0.75rem; }
        .tag-badge { background: #ffb703; color: #780000; font-size: 0.7rem; font-weight: bold; padding: 2px 10px; border-radius: 12px; display: inline-block; margin-top: 2px; }
        .info-bar { display: flex; justify-content: space-between; margin: 10px 0 8px 0; font-size: 0.88rem; font-weight: bold; color: #003049; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
        .line { border-bottom: 2px dotted #c1121f; color: #003049; font-weight: bold; padding: 0 4px; }
        .body-text { font-size: 0.92rem; line-height: 1.65; margin: 10px 0; }
        .footer { display: flex; justify-content: space-between; align-items: center; border-top: 2px dashed #c1121f; padding-top: 8px; margin-top: 8px; }
        .amount-pill { background: linear-gradient(135deg, #ffb703, #fb8500); color: white; padding: 5px 16px; border-radius: 20px; font-weight: bold; font-size: 1.15rem; }
        .thank-you { color: #c1121f; font-weight: bold; font-size: 0.88rem; text-align: center; }
        .collector { font-size: 0.75rem; color: #6c757d; text-align: center; margin-top: 2px; }
        .events-card { border: 3px solid #ffb703; border-radius: 14px; padding: 10px; background: #fffdf5; }
        .events-header { text-align: center; background: linear-gradient(135deg, #003049, #1d2d44); color: white; padding: 6px; border-radius: 8px; margin-bottom: 8px; }
        .events-header h3 { color: #ffea00; font-size: 0.98rem; }
        .events-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .event-item { background: white; border: 1.5px solid #fde68a; padding: 8px 10px; border-radius: 8px; display: flex; align-items: center; gap: 10px; }
        .event-icon-box { background: #fef3c7; padding: 4px; border-radius: 8px; display: flex; align-items: center; justify-content: center; min-width: 34px; min-height: 34px; }
        .event-item h4 { font-size: 0.88rem; color: #c1121f; font-weight: bold; }
      </style>
    </head>
    <body>
      <div id="receiptContainer">
        <div class="receipt-card">
          <div class="receipt-inner">
            <div class="garland"></div>
            <div class="header">
              <div class="ganesh-box">${ganeshHeaderSvg}</div>
              <div class="header-text">
                <div class="sub-header">${t.subHeader}</div>
                <h2>${t.title}</h2>
                <p>${t.address}</p>
                <div class="tag-badge">${t.tag}</div>
              </div>
            </div>
            <div class="info-bar">
              <span>${t.receiptNo} <strong class="line">${data.receiptNo}</strong></span>
              <span>${t.date} <strong class="line">${data.today}</strong></span>
            </div>
            <div class="body-text">${receiptTextBody}</div>
            <div class="footer">
              <div>
                <div class="amount-pill">₹ ${Number(data.amount).toLocaleString('en-IN')}/-</div>
                <div style="font-size:0.78rem; margin-top:4px;">${t.mode} <strong>${data.paymentMode}</strong></div>
              </div>
              <div>
                <div class="thank-you">${t.thankYou}</div>
                <div class="collector">प्रतिनिधी: ${data.collectedBy}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="events-card">
          <div class="events-header">
            <h3>🎉 ${t.festTitle}</h3>
          </div>
          <div class="events-grid">
            ${t.festivals.map(item => `
              <div class="event-item">
                <div class="event-icon-box">${eventIcons[item.iconKey] || eventIcons.ganesh}</div>
                <div><h4>${item.name}</h4></div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

    let page;
    try {
        if (!global.sharedBrowser || !global.sharedBrowser.isConnected()) {
            global.sharedBrowser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process'
                ]
            });
        }

        page = await global.sharedBrowser.newPage();
        await page.setViewport({ width: 750, height: 900, deviceScaleFactor: 1.5 });
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

        const element = await page.$('#receiptContainer');
        const imageBase64 = await element.screenshot({ encoding: 'base64', type: 'png' });

        await page.close();

        return { imageBase64: `data:image/png;base64,${imageBase64}` };

    } catch (err) {
        if (page) await page.close().catch(() => { });
        global.sharedBrowser = null;
        throw err;
    }
}

module.exports = { generateReceiptPDF };