const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const express = require("express");

const TOKEN = "8841041534:AAGZrjCDhU_lGe_p4yY-EmQ3-JsvJQxEmI0";
const OWNER_ID = 7756391343;

const bot = new TelegramBot(TOKEN, {
    polling: true
});

let collecting = false;
let records = [];
let accountSet = new Set();

let totalRecords = 0;
let totalTodayDeposit = 0;
let totalMonthDeposit = 0;

// FIXED: Now accurately detects keys even if there are spaces before/after the colons
function isValidRecord(text) {
    const requiredFields = [
        "Ws账号",
        "平台账号",
        "进粉日期",
        "IP状态",
        "今日首存",
        "本月首存"
    ];

    // Uses regex to search for the field name regardless of spaces and colon style
    return requiredFields.every(field => {
        const regex = new RegExp(field + "\\s*[：:]");
        return regex.test(text);
    });
}

function extractData(text) {
    // Upgraded patterns to perfectly capture values across varying spacing configurations
    const platformMatch = text.match(/平台账号\s*[：:]\s*(\S+)/);
    const todayMatch = text.match(/今日首存\s*[：:]\s*(\d+)/);
    const monthMatch = text.match(/本月首存\s*[：:]\s*(\d+)/);

    return {
        platformAccount: platformMatch ? platformMatch[1] : null,
        todayDeposit: todayMatch ? parseInt(todayMatch[1], 10) : 0,
        monthDeposit: monthMatch ? parseInt(monthMatch[1], 10) : 0
    };
}

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
        `📊 Current Summary\n\nTotal Records: ${totalRecords}\n\nTotal 今日首存: ${totalTodayDeposit}\n\nTotal 本月首存: ${totalMonthDeposit}`
    );
});

bot.onText(/\/stopcollect/, async (msg) => {
    if (msg.from.id !== OWNER_ID) return;

    collecting = false;

    let report = "";
    report += "===== REPORT =====\n\n";
    report += `Total Records: ${totalRecords}\n`;
    report += `Total 今日首存: ${totalTodayDeposit}\n`;
    report += `Total 本月首存: ${totalMonthDeposit}\n\n`;
    report += "========================\n\n";
    report += records.join("\n\n----------------------\n\n");

    const fileName = `report_${Date.now()}.txt`;
    fs.writeFileSync(fileName, report);

    await bot.sendDocument(msg.chat.id, fileName);

    bot.sendMessage(
        msg.chat.id,
        `✅ Collection Stopped\n\n📊 Total Records: ${totalRecords}\n💰 Total 今日首存: ${totalTodayDeposit}\n📅 Total 本月首存: ${totalMonthDeposit}`
    );

    fs.unlinkSync(fileName);
});

bot.on("message", async (msg) => {
    console.log("MESSAGE RECEIVED:");
    console.log(msg);
    if (!collecting) return;
    if (!msg.text) return;
    if (msg.text.startsWith("/")) return;

    const text = msg.text.trim();
    if (!isValidRecord(text)) return;

    const data = extractData(text);
    if (!data.platformAccount) return;

    if (accountSet.has(data.platformAccount)) {
        return bot.sendMessage(
            msg.chat.id,
            `⚠ Duplicate Account\n\n平台账号: ${data.platformAccount}`
        );
    }

    accountSet.add(data.platformAccount);
    totalRecords++;
    totalTodayDeposit += data.todayDeposit;
    totalMonthDeposit += data.monthDeposit;
    records.push(text);

    bot.sendMessage(
        msg.chat.id,
        `✅ Saved\n\n平台账号: ${data.platformAccount}\n\nTotal Records: ${totalRecords}`
    );
});

// ===================================================
// FIX FOR RENDER: Web Server to Bind Port
// ===================================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Bot is up and running!");
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

console.log("Bot Running...");
