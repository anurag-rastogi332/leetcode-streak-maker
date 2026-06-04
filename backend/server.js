import express from "express";
import cors from "cors";
import axios from "axios";
import nodemailer from "nodemailer";
import cron from "node-cron";
import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";

dotenv.config();

dns.setDefaultResultOrder("ipv4first");
console.log("✅ IPv4 First Enabled");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   MongoDB Connection
========================= */

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        logActivity("✅ MongoDB Connected");
    })
    .catch((err) => {
        logActivity("❌ MongoDB Error: " + err.message);
    });

/* =========================
   Event Emitter (SSE)
========================= */
import { EventEmitter } from "events";
const logEmitter = new EventEmitter();

let logs = [];
let logCounter = 0;

function logActivity(message) {
    console.log(message);
    logCounter++;
    const logObj = { id: logCounter, time: new Date().toLocaleTimeString(), message };
    logs.push(logObj);
    if (logs.length > 50) logs.shift(); // Keep last 50
    logEmitter.emit("log", logObj);
}

app.get("/api/logs", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(`data: ${JSON.stringify(logs)}\n\n`);

    const listener = (logObj) => {
        res.write(`data: ${JSON.stringify([logObj])}\n\n`);
    };

    logEmitter.on("log", listener);

    req.on("close", () => {
        logEmitter.off("log", listener);
    });
});

/* =========================
   Schemas & Models
========================= */

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true }
});

const settingSchema = new mongoose.Schema({
    cronTime: { type: String, default: "20:00" }, // e.g. "20:00"
});

const User = mongoose.model("User", userSchema);
const Setting = mongoose.model("Setting", settingSchema);

/* =========================
   Email Transporter
========================= */

// const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});


transporter.verify((error, success) => {

    if (error) {

        console.error("SMTP VERIFY ERROR");
        console.error(error);

        logActivity(
            "❌ SMTP VERIFY FAILED: " +
            error.message
        );

    } else {

        console.log("SMTP SERVER READY");

        logActivity(
            "✅ SMTP SERVER READY"
        );
    }

});
/* =========================
   Register User
========================= */

app.post("/register", async (req, res) => {

    try {

        const { username, email } = req.body;

        if (!username || !email) {
            return res.status(400).json({
                message: "Username and Email are required"
            });
        }

        const existingUser =
            await User.findOne({ email });

        if (existingUser) {
            return res.json({
                message: "Email already registered"
            });
        }

        const user = await User.create({
            username,
            email
        });

        res.json({
            message: "User Registered Successfully",
            user
        });

    } catch (error) {

        res.status(500).json({
            error: error.message
        });
    }
});

/* =========================
   Check LeetCode Activity
========================= */
async function checkUser(user) {

    try {

        logActivity(`\n🔍 Checking ${user.username}`);

        const query = `
        query recentAcSubmissions($username: String!, $limit: Int!) {
            recentAcSubmissionList(
                username: $username,
                limit: $limit
            ) {
                title
                timestamp
            }
        }
        `;
       logActivity("STEP 1: Calling LeetCode API");
        const response = await axios.post(
            "https://leetcode.com/graphql",
            {
                query,
                variables: {
                    username: user.username,
                    limit: 50
                }
            }
        );
        logActivity("STEP 2: LeetCode API Success");

        const submissions =
            response?.data?.data?.recentAcSubmissionList || [];

        logActivity(
            `Accepted Submissions Found: ${submissions.length}`
        );

        const todayIST = new Date()
            .toLocaleDateString(
                "en-IN",
                {
                    timeZone: "Asia/Kolkata"
                }
            );

        logActivity(`Today IST: ${todayIST}`);

        let solvedToday = false;

        for (const sub of submissions) {

            const submissionDate =
                new Date(
                    Number(sub.timestamp) * 1000
                );

            const submissionIST =
                submissionDate.toLocaleDateString(
                    "en-IN",
                    {
                        timeZone: "Asia/Kolkata"
                    }
                );

            logActivity(`${sub.title} -> ${submissionIST}`);

            if (submissionIST === todayIST) {
                solvedToday = true;
                break;
            }
        }

        logActivity(
            `${user.username} => Solved Today: ${solvedToday}`
        );

        if (solvedToday) {
          logActivity("STEP 3: Sending Success Email");
            const info =
                await transporter.sendMail({
                   from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: "Great Job! 🎉",
                    text: `
Hi ${user.username},

Congratulations! 🎉

You solved a LeetCode problem today.

Keep coding and keep growing!

Profile:
https://leetcode.com/u/${user.username}/
`
                });
                logActivity("STEP 4: Success Email Sent");

            logActivity(
                "✅ Success Email Sent: " + info.messageId
            );

        } else {
    logActivity("STEP 3: Sending Reminder Email");
            const info =
                await transporter.sendMail({
                   from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: "LeetCode Reminder 🚀",
                    text: `
Hi ${user.username},

You haven't solved any LeetCode problem today.

Don't break your streak!

Profile:
https://leetcode.com/u/${user.username}/
`
                });
                logActivity("STEP 4: Reminder Email Sent");

            logActivity(
                "📧 Reminder Sent: " + info.messageId
            );
        }

    } catch (error) {

    logActivity("❌ CHECK USER ERROR");

    logActivity("MESSAGE: " + error.message);

    if (error.code) {
        logActivity("CODE: " + error.code);
    }

    if (error.response) {
        logActivity(
            "RESPONSE: " +
            JSON.stringify(error.response.data)
        );
    }

    console.log("====================================");
    console.log("FULL ERROR OBJECT");
    console.log(error);
    console.log("====================================");

    if (error.stack) {
        console.log(error.stack);
    }
}
}

/* =========================
   Manual Test Route
========================= */

app.get("/check-now", async (req, res) => {

    try {

        const users = await User.find();

        for (const user of users) {
            await checkUser(user);
        }

        res.json({
            message: "Check completed"
        });

    } catch (error) {

        res.status(500).json({
            error: error.message
        });
    }
});

/* =========================
   Cron Job & Settings
========================= */

let currentCronJob = null;

async function setupCron() {
    try {
        let setting = await Setting.findOne();
        if (!setting) {
            setting = await Setting.create({ cronTime: "20:00" });
        }

        if (currentCronJob) {
            currentCronJob.stop();
        }

        const [hour, minute] = setting.cronTime.split(":");
        const cronString = `${minute} ${hour} * * *`;

        logActivity(`🕒 Setting up cron job for ${setting.cronTime} (${cronString})`);

        currentCronJob = cron.schedule(
            cronString,
            async () => {
                try {
                    logActivity("🚀 Running Daily Check...");
                    const users = await User.find();
                    for (const user of users) {
                        await checkUser(user);
                    }
                    logActivity("✅ Daily Check Complete!");
                } catch (error) {
                    logActivity("Cron Error: " + error.message);
                }
            },
            { timezone: "Asia/Kolkata" }
        );
    } catch (e) {
        logActivity("❌ Error setting up cron: " + e.message);
    }
}

// Call on startup
setupCron();

app.get("/api/settings", async (req, res) => {
    try {
        let setting = await Setting.findOne();
        if (!setting) setting = await Setting.create({ cronTime: "20:00" });
        res.json(setting);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/settings", async (req, res) => {
    try {
        const { cronTime } = req.body;
        if (!cronTime) return res.status(400).json({ error: "cronTime (HH:mm) is required" });

        let setting = await Setting.findOne();
        if (!setting) {
            setting = await Setting.create({ cronTime });
        } else {
            setting.cronTime = cronTime;
            await setting.save();
        }

        // Restart cron with new time
        await setupCron();

        logActivity(`🕒 Global check time updated to ${cronTime}`);
        res.json({ message: "Settings updated successfully", setting });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/* =========================
   Routes
========================= */

app.get("/", (req, res) => {
    res.send(
        "🚀 LeetCode Streak Guardian Running"
    );
});

app.get("/users", async (req, res) => {

    try {

        const users =
            await User.find();

        res.json(users);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });
    }
});

/* =========================
   Server
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `🚀 Server running on port ${PORT}`
    );
});