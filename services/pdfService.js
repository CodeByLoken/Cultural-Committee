const puppeteer = require('puppeteer');

// ... (Your labels, ganeshHeaderSvg, and eventIcons remain unchanged) ...

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
        /* Inline fallback fonts to prevent waiting on external Google Fonts */
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
        // 1. Re-launch browser if null or disconnected
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

        // 2. Open tab & block external network assets
        page = await global.sharedBrowser.newPage();
        await page.setViewport({ width: 750, height: 900, deviceScaleFactor: 1.5 }); // reduced scale factor for faster rendering

        // SPEED OPTIMIZATION: Wait ONLY for DOM ready, do NOT wait for networkidle
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

        // 3. Take PNG Screenshot only (skip page.pdf unless explicitly required)
        const element = await page.$('#receiptContainer');
        const imageBase64 = await element.screenshot({ encoding: 'base64', type: 'png' });

        await page.close();

        return { imageBase64: `data:image/png;base64,${imageBase64}` };

    } catch (err) {
        if (page) await page.close().catch(() => { });
        // Reset global browser on failure so it re-opens fresh next time
        global.sharedBrowser = null;
        throw err;
    }
}

module.exports = { generateReceiptPDF };