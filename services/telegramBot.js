const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const path = require('path');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8798200381:AAESQJoeVpzSk0COo9Ma3lkJxI9vFSpthWQ";
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "684873178";

// Initialize Bot with Long Polling
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("🤖 Telegram Control Bot initialized and listening for commands...");

// Security Middleware: Only allow commands from your specific Chat ID
function isAuthorized(msg) {
    return String(msg.chat.id) === String(ADMIN_CHAT_ID);
}

// 1. Command: /start or /help
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

// 2. Command: /reports (Triggers update_excel.js)
bot.onText(/\/reports/, (msg) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, "⛔ Unauthorized access!");
    }

    bot.sendMessage(msg.chat.id, "🔄 *Executing \`update_excel.js\`...*\nFetching Neon DB records and generating Excel reports...", { parse_mode: 'Markdown' });

    exec('node update_excel.js', (error, stdout, stderr) => {
        if (error) {
            console.error("❌ Telegram Trigger Error (update_excel):", error.message);
            return bot.sendMessage(msg.chat.id, `🚨 *Execution Failed!*\n\nError: \`${error.message}\``, { parse_mode: 'Markdown' });
        }

        console.log(stdout);
        bot.sendMessage(msg.chat.id, `✅ *Success! Reports generated & emailed!*\n\n\`\`\`\n${stdout.slice(-300)}\n\`\`\``, { parse_mode: 'Markdown' });
    });
});

// 3. Command: /regenerate_images (Triggers regenerate-missing-images.js)
bot.onText(/\/regenerate_images/, (msg) => {
    if (!isAuthorized(msg)) {
        return bot.sendMessage(msg.chat.id, "⛔ Unauthorized access!");
    }

    bot.sendMessage(msg.chat.id, "⏳ *Executing \`regenerate-missing-images.js\`...*\nScanning database for missing image links...", { parse_mode: 'Markdown' });

    exec('node regenerate-missing-images.js', (error, stdout, stderr) => {
        if (error) {
            console.error("❌ Telegram Trigger Error (regenerate-missing-images):", error.message);
            return bot.sendMessage(msg.chat.id, `🚨 *Execution Failed!*\n\nError: \`${error.message}\``, { parse_mode: 'Markdown' });
        }

        console.log(stdout);
        bot.sendMessage(msg.chat.id, `✅ *Image Regeneration Completed!*\n\n\`\`\`\n${stdout.slice(-300)}\n\`\`\``, { parse_mode: 'Markdown' });
    });
});

// 4. Command: /status
bot.onText(/\/status/, (msg) => {
    if (!isAuthorized(msg)) return;
    bot.sendMessage(msg.chat.id, "🟢 *Server Status:* Online & Responsive!", { parse_mode: 'Markdown' });
});

module.exports = bot;