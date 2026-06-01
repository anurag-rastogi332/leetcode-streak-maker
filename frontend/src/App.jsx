import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

const App = () => {

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [totalUsers, setTotalUsers] = useState(0);

    const [cronTime, setCronTime] = useState("");
    const [logs, setLogs] = useState([]);
    const [settingLoading, setSettingLoading] = useState(false);
    
    const logsEndRef = useRef(null);

    useEffect(() => {
        fetchUsers();
        fetchSettings();

        // Server-Sent Events for Live Logs
        const eventSource = new EventSource(`${API}/api/logs`);
        eventSource.onmessage = (event) => {
            const newLogs = JSON.parse(event.data);
            setLogs((prevLogs) => {
                const combined = [...prevLogs, ...newLogs];
                // Keep only unique ones by id if possible, though React handles simple arrays fine
                const unique = Array.from(new Set(combined.map(a => a.id)))
                 .map(id => {
                   return combined.find(a => a.id === id)
                 })
                 .sort((a, b) => a.id - b.id);
                return unique.slice(-50);
            });
        };

        return () => eventSource.close();
    }, []);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs]);

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${API}/users`);
            setTotalUsers(res.data.length);
        } catch (error) {
            console.log(error);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`${API}/api/settings`);
            if (res.data && res.data.cronTime) {
                setCronTime(res.data.cronTime);
            }
        } catch (error) {
            console.log(error);
        }
    };

    const updateCronTime = async () => {
        try {
            setSettingLoading(true);
            await axios.post(`${API}/api/settings`, { cronTime });
            alert(`Checking time updated to ${cronTime}`);
        } catch (error) {
            console.log(error);
            alert("Failed to update time");
        } finally {
            setSettingLoading(false);
        }
    };

    const runManualCheck = async () => {
        try {
            alert("Starting manual check... See logs panel!");
            await axios.get(`${API}/check-now`);
        } catch (error) {
            console.log(error);
        }
    };

    const registerUser = async () => {

        if (!username.trim()) {
            return alert(
                "Please enter LeetCode username"
            );
        }

        if (!email.trim()) {
            return alert(
                "Please enter email"
            );
        }

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return alert(
                "Please enter valid email"
            );
        }

        try {

            setLoading(true);
            setMessage("");

            const res = await axios.post(
                `${API}/register`,
                {
                    username,
                    email
                }
            );

            setMessage(res.data.message);

            setUsername("");
            setEmail("");

            fetchUsers();

        } catch (error) {

            console.log(error);

            setMessage(
                "Something went wrong"
            );

        } finally {

            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: "20px",
                background:
                    "linear-gradient(135deg,#0f172a,#1e293b,#020617)",
                padding: "20px",
                fontFamily:
                    "Segoe UI, sans-serif"
            }}
        >
            {/* Left Card: Registration */}
            <div
                style={{
                    width: "430px",
                    background:
                        "rgba(255,255,255,0.08)",
                    backdropFilter:
                        "blur(20px)",
                    borderRadius: "25px",
                    padding: "35px",
                    color: "white",
                    border:
                        "1px solid rgba(255,255,255,0.1)",
                    boxShadow:
                        "0 10px 40px rgba(0,0,0,0.4)"
                }}
            >
                <h1
                    style={{
                        textAlign: "center",
                        marginBottom: "10px"
                    }}
                >
                    🚀 LeetCode Guardian
                </h1>

                <p
                    style={{
                        textAlign: "center",
                        color: "#cbd5e1",
                        marginBottom: "25px"
                    }}
                >
                    Never break your streak again
                </p>

                <div
                    style={{
                        textAlign: "center",
                        marginBottom: "25px",
                        padding: "12px",
                        borderRadius: "12px",
                        background:
                            "rgba(255,255,255,0.05)"
                    }}
                >
                    👥 {totalUsers} Developers Protected
                </div>

                <label>
                    LeetCode Username
                </label>

                <input
                    type="text"
                    value={username}
                    placeholder="Enter Username"
                    onChange={(e) =>
                        setUsername(
                            e.target.value
                        )
                    }
                    style={{
                        width: "100%",
                        padding: "14px",
                        marginTop: "8px",
                        marginBottom: "20px",
                        borderRadius: "12px",
                        border: "none",
                        outline: "none"
                    }}
                />

                {
                    username && (
                        <a
                            href={`https://leetcode.com/u/${username}/`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                color: "#38bdf8",
                                display:
                                    "inline-block",
                                marginBottom:
                                    "20px"
                            }}
                        >
                            🔗 Preview Profile
                        </a>
                    )
                }

                <label>
                    Email Address
                </label>

                <input
                    type="email"
                    value={email}
                    placeholder="Enter Email"
                    onChange={(e) =>
                        setEmail(
                            e.target.value
                        )
                    }
                    style={{
                        width: "100%",
                        padding: "14px",
                        marginTop: "8px",
                        marginBottom: "25px",
                        borderRadius: "12px",
                        border: "none",
                        outline: "none"
                    }}
                />

                <button
                    onClick={registerUser}
                    disabled={loading}
                    style={{
                        width: "100%",
                        padding: "15px",
                        border: "none",
                        borderRadius: "12px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "16px",
                        color: "white",
                        background:
                            "linear-gradient(135deg,#f97316,#ea580c)"
                    }}
                >
                    {
                        loading
                            ? "Registering..."
                            : "Register Now 🚀"
                    }
                </button>

                {
                    message && (
                        <div
                            style={{
                                marginTop: "20px",
                                textAlign:
                                    "center",
                                padding: "10px",
                                borderRadius:
                                    "10px",
                                background:
                                    "rgba(255,255,255,0.08)"
                            }}
                        >
                            {message}
                        </div>
                    )
                }

                <div
                    style={{
                        marginTop: "30px",
                        fontSize: "14px",
                        color: "#94a3b8"
                    }}
                >
                    ✅ Daily Reminder Emails
                    <br />
                    ✅ Streak Protection
                    <br />
                    ✅ Automatic Tracking
                    <br />
                    ✅ Free Forever
                </div>

                <p
                    style={{
                        textAlign: "center",
                        marginTop: "25px",
                        color: "#64748b",
                        fontSize: "13px"
                    }}
                >
                    Made with ❤️ for LeetCode
                    Developers
                </p>
            </div>

            {/* Right Card: Settings & Live Logs */}
            <div
                style={{
                    width: "430px",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    background: "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(20px)",
                    borderRadius: "25px",
                    padding: "35px",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.4)"
                }}
            >
                <h2 style={{ textAlign: "center", marginBottom: "15px" }}>⚙️ Control Panel</h2>

                <label>Daily Check Time (IST)</label>
                <div style={{ display: "flex", gap: "10px", marginTop: "8px", marginBottom: "20px" }}>
                    <input
                        type="time"
                        value={cronTime}
                        onChange={(e) => setCronTime(e.target.value)}
                        style={{
                            flex: 1,
                            padding: "14px",
                            borderRadius: "12px",
                            border: "none",
                            outline: "none"
                        }}
                    />
                    <button
                        onClick={updateCronTime}
                        disabled={settingLoading}
                        style={{
                            padding: "14px 20px",
                            border: "none",
                            borderRadius: "12px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            color: "white",
                            background: "linear-gradient(135deg,#3b82f6,#2563eb)"
                        }}
                    >
                        Save
                    </button>
                </div>
                
                <button
                    onClick={runManualCheck}
                    style={{
                        width: "100%",
                        padding: "15px",
                        border: "none",
                        borderRadius: "12px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "16px",
                        color: "white",
                        background: "linear-gradient(135deg,#10b981,#059669)",
                        marginBottom: "25px"
                    }}
                >
                     Check Now ⚡
                </button>

                <h3 style={{ marginBottom: "10px" }}>📡 Live Activities</h3>
                <div
                    style={{
                        flex: 1,
                        background: "#0f172a",
                        borderRadius: "12px",
                        padding: "15px",
                        overflowY: "auto",
                        minHeight: "250px",
                        maxHeight: "300px",
                        fontSize: "13px",
                        fontFamily: "monospace",
                        color: "#34d399",
                        border: "1px solid rgba(255,255,255,0.1)"
                    }}
                >
                    {logs.length === 0 ? (
                        <span style={{ color: "#64748b" }}>Waiting for logs...</span>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} style={{ marginBottom: "8px" }}>
                                <span style={{ color: "#94a3b8" }}>[{log.time}]</span> {log.message}
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>

        </div>
    );
};

export default App;