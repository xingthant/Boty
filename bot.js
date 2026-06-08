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
// STATE
// =========================
let collecting = false;
let records = [];

let totalRecords = 0;
let totalTodayDeposit = 0;
let totalMonthDeposit = 0;

// =========================
// EXTRACT DEPOSITS (If present)
// =========================
function extractData(text) {
    // Supports standard and full-width Chinese spaces/colons
    const todayMatch = text.match(/今日首存[\s\u3000]*[：:][\s\u3000]*(\d+)/);
    const monthMatch = text.match(/本月首存[\s\u3000]*[：:][\s\u3000]*(\d+)/);

    return {
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

    totalRecords = 0;
    totalTodayDeposit = 0;
    totalMonthDeposit = 0;

    bot.sendMessage(msg.chat.id, "✅ Collection Started (Saving all messages)");
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
// MESSAGE HANDLER (NO VALIDATION)
// =========================
bot.on("message", (msg) => {
    if (!collecting) return;
    if (!msg.text) return;
    if (msg.text.startsWith("/")) return; // Ignore bot commands

    const text = msg.text.trim();
    
    // Extract data if matching keywords exist; otherwise defaults to 0
    const data = extractData(text);

    // Save EVERYTHING
    totalRecords++;
    totalTodayDeposit += data.todayDeposit;
    totalMonthDeposit += data.monthDeposit;
    
    // Formats record line with sender details for the report file
    const senderName = msg.from.username ? `@${msg.from.username}` : `${msg.from.first_name || 'User'}`;
    records.push(`[Sender: ${senderName}]\n${text}`);

    // Simple acknowledgement response in the group chat
    bot.sendMessage(
        msg.chat.id,
        `✅ Message #${totalRecords} Saved`
    );
});

// =========================
// EXPRESS SERVER
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
