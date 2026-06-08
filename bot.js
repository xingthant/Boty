const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const express = require("express");

const TOKEN = "8841041534:AAE1wljybAZaOu1sB3WQK4JN6aqNTgsRRyU"; // 🔥 replace this
const OWNER_ID = 7756391343;

const bot = new TelegramBot(TOKEN, {
    polling: true
});

// =========================
// 🔥 ERROR HANDLING FIX
// =========================
bot.on("polling_error", (err) => {
    console.log("❌ Polling error:", err.code || err.message);
});

bot.on("error", (err) => {
    console.log("❌ Bot error:", err);
});

// =========================
// STATE
// =========================
let collecting = false;
let records = [];
let accountSet = new Set();

let totalRecords = 0;
let totalTodayDeposit = 0;
let totalMonthDeposit = 0;

// =========================
// VALIDATION
// =========================
function isValidRecord(text) {
    const requiredFields = [
        "Ws账号",
        "平台账号",
        "进粉日期",
        "IP状态",
        "今日首存",
        "本月首存"
    ];

    return requiredFields.every(field => {
        const regex = new RegExp(field + "\\s*[：:]");
        return regex.test(text);
    });
}

// =========================
// EXTRACT DATA
// =========================
function extractData(text) {
    const platformMatch = text.match(/平台账号\s*[：:]\s*(\S+)/);
    const todayMatch = text.match(/今日首存\s*[：:]\s*(\d+)/);
    const monthMatch = text.match(/本月首存\s*[：:]\s*(\d+)/);

    return {
        platformAccount: platformMatch ? platformMatch[1] : null,
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

    bot.sendMessage(msg.chat.id, "✅ Collection Started");
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

    await bot.sendDocument(msg.chat.id, fileName);

    bot.sendMessage(
        msg.chat.id,
        `✅ Stopped\n\nRecords: ${totalRecords}\nToday: ${totalTodayDeposit}\nMonth: ${totalMonthDeposit}`
    );

    fs.unlinkSync(fileName);
});

// =========================
// MESSAGE HANDLER
// =========================
bot.on("message", (msg) => {
    if (!collecting) return;
    if (!msg.text) return;
    if (msg.text.startsWith("/")) return;

    const text = msg.text.trim();

    if (!isValidRecord(text)) return;

    const data = extractData(text);
    if (!data.platformAccount) return;

    if (accountSet.has(data.platformAccount)) {
        bot.sendMessage(msg.chat.id, `⚠ Duplicate: ${data.platformAccount}`);
        return;
    }

    accountSet.add(data.platformAccount);
    totalRecords++;
    totalTodayDeposit += data.todayDeposit;
    totalMonthDeposit += data.monthDeposit;
    records.push(text);

    bot.sendMessage(
        msg.chat.id,
        `✅ Saved\nAccount: ${data.platformAccount}\nTotal: ${totalRecords}`
    );
});

// =========================
// EXPRESS SERVER (Render FIX)
// =========================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Bot is running 🔥");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

console.log("🤖 Bot started...");
