const { exec } = require('child_process');
const { Pool } = require('pg');
const TelegramBotPackage = require('node-telegram-bot-api');

const TelegramBot = typeof TelegramBotPackage === 'function'
    ? TelegramBotPackage
    : (TelegramBotPackage.default || TelegramBotPackage);

const { runDailyReportAndEmail } = require('../update_excel');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

if (!BOT_TOKEN) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN is not defined. Telegram Bot Service disabled.");
    module.exports = null;
} else {
    // Database Connection Pool for Runtime Checks
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    // Force IPv4 DNS resolution for Telegram polling & API requests
    const bot = new TelegramBot(BOT_TOKEN, {
        polling: {
            autoStart: true,
            params: { timeout: 10 }
        },
        request: {
            agentOptions: {
                family: 4
            }
        }
    });

    console.log("🤖 Telegram Control Bot initialized and listening for commands...");

    function isAuthorized(msg) {
        return String(msg.chat.id) === String(ADMIN_CHAT_ID);
    }

    // Helper function to count receipts with missing images from Neon DB
    async function getMissingImagesCount() {
        try {
            const query = `
                SELECT COUNT(*) AS count 
                FROM receipts 
                WHERE image_url IS NULL OR image_url = '' OR image_url = 'N/A';
            `;
            const res = await pool.query(query);
            return parseInt(res.rows[0].count, 10);
        } catch (err) {
            console.error("Error checking missing images count:", err);
            return 0;
        }
    }

    // Help / Start Command
    bot.onText(/\/(start|help)/, (msg) => {
        if (!isAuthorized(msg)) return;
        const helpMessage = `
🚩 *Purvanchal Portal Server Control Bot*

Available Commands:
📊 \`/reports\` - Generate building-wise Excel reports & send via Email
🔍 \`/check_missing\` - Audit DB for receipts missing image URLs
🖼️ \`/regenerate_images\` - Fix & regenerate all missing receipt images
ℹ️ \`/status\` - Check server health & DB image status
        `;
        bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' });
    });

    // 1. Reports Command
    bot.onText(/\/reports/, async (msg) => {
        if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, "⛔ Unauthorized access!");

        bot.sendMessage(msg.chat.id, "🔄 *Generating Excel reports and emailing...*", { parse_mode: 'Markdown' });

        try {
            const result = await runDailyReportAndEmail();

            let duplicateText = "\n\n🔁 *No duplicate flat entries in DB.*";
            if (result.duplicates && result.duplicates.length > 0) {
                const flatList = result.duplicates.map(f => `   • Flat: \`${f}\``).join('\n');
                duplicateText = `\n\n🔁 *DUPLICATE RECEIPTS FOUND IN DB (${result.duplicates.length}):*\n${flatList}`;
            }

            const successMessage = `✅ *Success! Reports generated & emailed!*

📊 *Total DB Receipts:* ${result.receipts}
📄 *Excel Files Created:* ${result.count}
📅 *Date Stamp:* \`${result.dateStr}\`${duplicateText}`;

            bot.sendMessage(msg.chat.id, successMessage, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error("🚨 Report Error:", error);
            bot.sendMessage(msg.chat.id, `🚨 *Report Generation Failed!*\n\nError: \`${error.message}\``, { parse_mode: 'Markdown' });
        }
    });

    // 2. Check Missing Images Command
    bot.onText(/\/check_missing/, async (msg) => {
        if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, "⛔ Unauthorized access!");

        bot.sendMessage(msg.chat.id, "🔍 *Checking DB for missing images...*", { parse_mode: 'Markdown' });

        const count = await getMissingImagesCount();

        if (count > 0) {
            const warningMsg = `⚠️ *Found ${count} receipt(s) missing images in Neon DB!*\n\n👉 Send \`/regenerate_images\` to fix them now.`;
            bot.sendMessage(msg.chat.id, warningMsg, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(msg.chat.id, "✅ *All receipt records have valid image URLs!*", { parse_mode: 'Markdown' });
        }
    });

    // 3. Regenerate Images Command (Executes node regenerate-missing-images.js)
    bot.onText(/\/regenerate_images/, async (msg) => {
        if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, "⛔ Unauthorized access!");

        bot.sendMessage(msg.chat.id, "🖼️ *Starting image regeneration script...*\n_This may take a few moments._", { parse_mode: 'Markdown' });

        exec('node regenerate-missing-images.js', (error, stdout, stderr) => {
            if (error) {
                console.error("🚨 Image Regeneration Error:", error);
                const errSnippet = (stderr || error.message).slice(-1000);
                return bot.sendMessage(
                    msg.chat.id,
                    `🚨 *Image Regeneration Failed!*\n\n\`\`\`\n${errSnippet}\n\`\`\``,
                    { parse_mode: 'Markdown' }
                );
            }

            const outputSnippet = stdout.slice(-1000) || "Process finished with no output.";
            bot.sendMessage(
                msg.chat.id,
                `✅ *Image Regeneration Completed Successfully!*\n\n\`\`\`\n${outputSnippet}\n\`\`\``,
                { parse_mode: 'Markdown' }
            );
        });
    });

    // 4. Server Status Command
    bot.onText(/\/status/, async (msg) => {
        if (!isAuthorized(msg)) return;

        const missingCount = await getMissingImagesCount();
        let imageAuditStatus = "✅ All receipt images intact";

        if (missingCount > 0) {
            imageAuditStatus = `⚠️ *${missingCount} receipt(s) missing images!* (Run \`/regenerate_images\`)`;
        }

        const statusMessage = `🟢 *Server Status:* Online & Responsive!\n🖼️ *Image Audit:* ${imageAuditStatus}`;
        bot.sendMessage(msg.chat.id, statusMessage, { parse_mode: 'Markdown' });
    });

    module.exports = bot;
}