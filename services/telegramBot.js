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

    bot.onText(/\/(start|help)/, (msg) => {
        if (!isAuthorized(msg)) return;
        const helpMessage = `
🚩 *Purvanchal Portal Server Control Bot*

Available Commands:
📊 \`/reports\` - Generate building-wise Excel reports & send via Email
🖼️ \`/regenerate_images\` - Fix & regenerate all missing receipt images
ℹ️ \`/status\` - Check server health & online status
        `;
        bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' });
    });

    // Directly execute function in-memory
    bot.onText(/\/reports/, async (msg) => {
        if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, "⛔ Unauthorized access!");

        bot.sendMessage(msg.chat.id, "🔄 *Generating Excel reports and emailing...*", { parse_mode: 'Markdown' });

        try {
            const result = await runDailyReportAndEmail();

            // Format Duplicate Flat Section
            let duplicateText = "🔁 *No duplicate flat entries in DB.*";
            if (result.duplicates && result.duplicates.length > 0) {
                const flatList = result.duplicates.map(f => `   • Flat: \`${f}\``).join('\n');
                duplicateText = `🔁 *DUPLICATE RECEIPTS FOUND IN DB (${result.duplicates.length}):*\n${flatList}`;
            }

            const successMessage = `✅ *Success! Reports generated & emailed!*

📊 *Total DB Receipts:* ${result.receipts}
📄 *Excel Files Created:* ${result.count}
📅 *Date Stamp:* \`${result.dateStr}\`

${duplicateText}`;

            bot.sendMessage(msg.chat.id, successMessage, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error("🚨 Report Error:", error);
            bot.sendMessage(msg.chat.id, `🚨 *Report Generation Failed!*\n\nError: \`${error.message}\``, { parse_mode: 'Markdown' });
        }
    });

    bot.onText(/\/status/, (msg) => {
        if (!isAuthorized(msg)) return;
        bot.sendMessage(msg.chat.id, "🟢 *Server Status:* Online & Responsive!", { parse_mode: 'Markdown' });
    });

    module.exports = bot;
}