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
    const bot = new TelegramBot(BOT_TOKEN, { polling: true });
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

    // Directly execute function in-memory (No child process / exec hanging)
    bot.onText(/\/reports/, async (msg) => {
        if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, "⛔ Unauthorized access!");

        bot.sendMessage(msg.chat.id, "🔄 *Generating Excel reports and emailing...*", { parse_mode: 'Markdown' });

        try {
            const result = await runDailyReportAndEmail();
            bot.sendMessage(
                msg.chat.id,
                `✅ *Success! Reports generated & emailed!*\n\n📊 Total DB Receipts: ${result.receipts}\n📄 Excel Files Created: ${result.count}\n📅 Date Stamp: \`${result.dateStr}\``,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            bot.sendMessage(msg.chat.id, `🚨 *Report Generation Failed!*\n\nError: \`${error.message}\``, { parse_mode: 'Markdown' });
        }
    });

    bot.onText(/\/status/, (msg) => {
        if (!isAuthorized(msg)) return;
        bot.sendMessage(msg.chat.id, "🟢 *Server Status:* Online & Responsive!", { parse_mode: 'Markdown' });
    });

    module.exports = bot;
}