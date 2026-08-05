const TelegramBotPackage = require('node-telegram-bot-api');
const TelegramBot = typeof TelegramBotPackage === 'function'
    ? TelegramBotPackage
    : (TelegramBotPackage.default || TelegramBotPackage);

const { exec } = require('child_process');

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

    bot.onText(/\/reports/, (msg) => {
        if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, "⛔ Unauthorized access!");

        bot.sendMessage(msg.chat.id, "🔄 *Executing \`update_excel.js\`...*\nFetching Neon DB records and generating Excel reports...", { parse_mode: 'Markdown' });

        exec('node update_excel.js', (error, stdout) => {
            if (error) {
                return bot.sendMessage(msg.chat.id, `🚨 *Execution Failed!*\n\nError: \`${error.message}\``, { parse_mode: 'Markdown' });
            }
            bot.sendMessage(msg.chat.id, `✅ *Success! Reports generated & emailed!*\n\n\`\`\`\n${stdout.slice(-300)}\n\`\`\``, { parse_mode: 'Markdown' });
        });
    });

    bot.onText(/\/regenerate_images/, (msg) => {
        if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, "⛔ Unauthorized access!");

        bot.sendMessage(msg.chat.id, "⏳ *Executing \`regenerate-missing-images.js\`...*\nScanning database for missing image links...", { parse_mode: 'Markdown' });

        exec('node regenerate-missing-images.js', (error, stdout) => {
            if (error) {
                return bot.sendMessage(msg.chat.id, `🚨 *Execution Failed!*\n\nError: \`${error.message}\``, { parse_mode: 'Markdown' });
            }
            bot.sendMessage(msg.chat.id, `✅ *Image Regeneration Completed!*\n\n\`\`\`\n${stdout.slice(-300)}\n\`\`\``, { parse_mode: 'Markdown' });
        });
    });

    bot.onText(/\/status/, (msg) => {
        if (!isAuthorized(msg)) return;
        bot.sendMessage(msg.chat.id, "🟢 *Server Status:* Online & Responsive!", { parse_mode: 'Markdown' });
    });

    module.exports = bot;
}