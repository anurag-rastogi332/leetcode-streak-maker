import express from "express";
import cors from "cors";
import axios from "axios";
import nodemailer from "nodemailer";
import cron from "node-cron";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   MongoDB Connection
========================= */

mongoose.connect( process.env.MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB Connected");
    })
    .catch((err) => {
        console.log("❌ MongoDB Error:", err.message);
    });

/* =========================
   User Schema & Model
========================= */

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    }
});

const User = mongoose.model("User", userSchema);

/* =========================
   Email Transporter
========================= */

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
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

        console.log(`\n🔍 Checking ${user.username}`);

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

        const submissions =
            response?.data?.data?.recentAcSubmissionList || [];

        console.log(
            "Accepted Submissions Found:",
            submissions.length
        );

        const todayIST = new Date()
            .toLocaleDateString(
                "en-IN",
                {
                    timeZone: "Asia/Kolkata"
                }
            );

        console.log("Today IST:", todayIST);

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

            console.log(
                `${sub.title} -> ${submissionIST}`
            );

            if (submissionIST === todayIST) {
                solvedToday = true;
                break;
            }
        }

        console.log(
            `${user.username} => Solved Today: ${solvedToday}`
        );

        if (solvedToday) {

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

            console.log(
                "✅ Success Email Sent:",
                info.messageId
            );

        } else {

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

            console.log(
                "📧 Reminder Sent:",
                info.messageId
            );
        }

    } catch (error) {

        console.log(
            "❌ CHECK USER ERROR"
        );

        console.log(
            error.response?.data ||
            error.message
        );
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
   Cron Job
========================= */

cron.schedule(
    "5 22 * * *",
    async () => {

        try {

            console.log(
                "🚀 Running Daily Check..."
            );

            const users =
                await User.find();

            for (const user of users) {
                await checkUser(user);
            }

        } catch (error) {

            console.log(
                "Cron Error:",
                error.message
            );
        }

    },
    {
        timezone: "Asia/Kolkata"
    }
);

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