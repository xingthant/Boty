const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const express = require("express");

const TOKEN = "8841041534:AAE1wljybAZaOu1sB3WQK4JN6aqNTgsRRyU";
const OWNER_ID = 7756391343;

const bot = new TelegramBot(TOKEN, {
    polling: true
});

// =========================
// ERROR HANDLING
// =========================
bot.on("polling_error", (err) => {
    console.log("❌ Polling error:", err.code || err.message);
});

bot.on("error", (err) => {
    console.log("❌ Bot error:", err);
});

// =========================
// STATE (Optimized for 512MB)
// =========================
let collecting = false;
let records = [];
let accountSet = new Set(); // Ultra-fast duplicate lookup

let totalRecords = 0;
let totalTodayDeposit = 0;
let totalMonthDeposit = 0;

// =========================
// LIGHTWEIGHT EXTRACTION
// =========================
function extractData(text) {
    // Supports standard spaces, full-width spaces, colons, and semicolons
    const platformMatch = text.match(/平台账号[\s\u3000]*[：:；;][\s\u3000]*(\d+)/);
    const todayMatch = text.match(/今日首存[\s\u3000]*[：:；;][\s\u3000]*(\d+)/);
    const monthMatch = text.match(/本月首存[\s\u3000]*[：:；;][\s\u3000]*(\d+)/);

    return {
        platformAccount: platformMatch ? platformMatch[1].trim() : null,
        todayDeposit: todayMatch ? parseInt(todayMatch[1], 10) : 0,
        monthDeposit: monthMatch ? parseInt(monthMatch[1], 10) : 0
    };
}

// =========================
// COMMANDS
// =========================
bot.onText(/\/startcollect/, (msg) => {
    if (msg.from.id !== OWNER_ID) return;

    collecting = true;
    records = [];
    accountSet.clear();

    totalRecords = 0;
    totalTodayDeposit = 0;
    totalMonthDeposit = 0;

    bot.sendMessage(msg.chat.id, "🚀 Silent Collection Started! (No more duplicate freezes)");
});

bot.onText(/\/summary/, (msg) => {
    if (msg.from.id !== OWNER_ID) return;

    bot.sendMessage(
        msg.chat.id,
        `📊 Summary\n\nTotal Records: ${totalRecords}\nToday Deposit: ${totalTodayDeposit}\nMonth Deposit: ${totalMonthDeposit}`
    );
});

bot.onText(/\/stopcollect/, async (msg) => {
    if (msg.from.id !== OWNER_ID) return;

    collecting = false;

    let report = `
===== REPORT =====

Total Records: ${totalRecords}
Today Deposit: ${totalTodayDeposit}
Month Deposit: ${totalMonthDeposit}

========================

${records.join("\n\n----------------------\n\n")}
`;

    const fileName = `report_${Date.now()}.txt`;
    fs.writeFileSync(fileName, report);

    try {
        await bot.sendDocument(msg.chat.id, fileName);
        bot.sendMessage(
            msg.chat.id,
            `✅ Stopped\n\nRecords: ${totalRecords}\nToday: ${totalTodayDeposit}\nMonth: ${totalMonthDeposit}`
        );
    } catch (err) {
        console.log("❌ Error sending document:", err.message);
    }

    if (fs.existsSync(fileName)) {
        fs.unlinkSync(fileName);
    }
});

// =========================
// ULTRA-FAST MESSAGE HANDLER (NO SPAM / NO LAG)
// =========================
bot.on("message", (msg) => {
    if (!collecting) return;
    if (!msg.text) return;
    if (msg.text.startsWith("/")) return; 

    const text = msg.text.trim();
    const data = extractData(text);

    // Instant Duplicate Check
    if (data.platformAccount) {
        if (accountSet.has(data.platformAccount)) {
            // Skips duplicates immediately without spending CPU cycles or replying
            return; 
        }
        accountSet.add(data.platformAccount);
    }

    // Process memory values instantly inside RAM
    totalRecords++;
    totalTodayDeposit += data.todayDeposit;
    totalMonthDeposit += data.monthDeposit;
    
    const senderName = msg.from.username ? `@${msg.from.username}` : `${msg.from.first_name || 'User'}`;
    records.push(`[Sender: ${senderName}]\n${text}`);

    // 🔥 FIXED: Removing the "Saved" message reply prevents Telegram from rate-limiting 
    // the bot when multiple members paste text blocks at the exact same time.
});

// =========================
// EXPRESS SERVER
// =========================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Bot is running safely on 512MB tier 🔥");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

console.log("🤖 Lightweight Bot started...");
