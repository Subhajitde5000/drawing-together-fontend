"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function generateRoomId() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function RoomFullPage() {
    const router = useRouter();
    const [creating, setCreating] = useState(false);

    function handleCreateRoom() {
        setCreating(true);
        const newRoomId = generateRoomId();
        router.push(`/room/${newRoomId}`);
    }

    return (
        <>
            <style>{`
        @keyframes floatIcon {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
          50%       { box-shadow: 0 0 0 12px rgba(99,102,241,0); }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

            <div
                style={{
                    minHeight: "100vh",
                    background: "linear-gradient(160deg, #f0f4ff 0%, #f8fafc 60%)",
                    display: "flex",
                    flexDirection: "column",
                    fontFamily: "var(--font-inter), Inter, sans-serif",
                }}
            >
                {/* ── HEADER ── */}
                <header
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        paddingTop: "2rem",
                        gap: 4,
                    }}
                >
                    <a
                        href="/"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            textDecoration: "none",
                        }}
                    >
                        <span style={{ fontSize: "1.6rem" }}>🎨</span>
                        <span
                            style={{
                                fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                fontWeight: 900,
                                fontSize: "1.3rem",
                                background: "linear-gradient(135deg, #6366f1, #22c55e)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                        >
                            DrawTogether
                        </span>
                    </a>
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 500 }}>
                        Real-time drawing with friends
                    </span>
                </header>

                {/* ── MAIN ── */}
                <main
                    style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "2rem 1rem",
                    }}
                >
                    <div
                        style={{
                            background: "white",
                            borderRadius: 24,
                            boxShadow:
                                "0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 60px rgba(99,102,241,0.1), 0 0 0 1px rgba(99,102,241,0.08)",
                            padding: "3rem 2.5rem",
                            maxWidth: 440,
                            width: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "1.5rem",
                            animation: "fadeUp 0.45s ease-out both",
                            textAlign: "center",
                        }}
                    >
                        {/* Icon */}
                        <span
                            style={{
                                fontSize: "5rem",
                                lineHeight: 1,
                                animation: "floatIcon 3s ease-in-out infinite",
                                display: "block",
                            }}
                        >
                            👥
                        </span>

                        {/* Badge */}
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 14px",
                                borderRadius: 9999,
                                background: "#fef3c7",
                                border: "1.5px solid #fde68a",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                color: "#92400e",
                            }}
                        >
                            ⚠️ Room Full
                        </div>

                        {/* Title */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <h1
                                style={{
                                    margin: 0,
                                    fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                    fontWeight: 900,
                                    fontSize: "clamp(1.6rem, 5vw, 2rem)",
                                    color: "#0f172a",
                                    letterSpacing: "-0.5px",
                                }}
                            >
                                This room is full
                            </h1>
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: "1rem",
                                    color: "#64748b",
                                    lineHeight: 1.6,
                                    maxWidth: 320,
                                }}
                            >
                                Only two players can join a room.
                                <br />
                                Create a new room to start drawing.
                            </p>
                        </div>

                        {/* Divider */}
                        <div style={{ width: "100%", height: 1, background: "#f1f5f9" }} />

                        {/* Primary CTA */}
                        <button
                            id="create-new-room-btn"
                            onClick={handleCreateRoom}
                            disabled={creating}
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                padding: "0.9rem 1.5rem",
                                background: creating
                                    ? "#a5b4fc"
                                    : "linear-gradient(135deg, #6366f1, #4f46e5)",
                                color: "white",
                                border: "none",
                                borderRadius: 14,
                                fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                fontWeight: 800,
                                fontSize: "1.05rem",
                                cursor: creating ? "wait" : "pointer",
                                boxShadow: creating ? "none" : "0 4px 16px rgba(99,102,241,0.4)",
                                animation: creating ? "none" : "pulse 2.5s ease-in-out infinite",
                                transition: "all 0.25s ease",
                                letterSpacing: "0.01em",
                            }}
                        >
                            {creating ? "⏳ Creating room…" : "✨ Create New Room"}
                        </button>

                        {/* Secondary */}
                        <a
                            href="/"
                            style={{
                                fontSize: "0.85rem",
                                color: "#94a3b8",
                                fontWeight: 600,
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                transition: "color 0.2s ease",
                            }}
                            onMouseEnter={(e) =>
                                ((e.currentTarget as HTMLAnchorElement).style.color = "#6366f1")
                            }
                            onMouseLeave={(e) =>
                                ((e.currentTarget as HTMLAnchorElement).style.color = "#94a3b8")
                            }
                        >
                            ← Go Back Home
                        </a>
                    </div>
                </main>

                {/* ── FOOTER ── */}
                <footer
                    style={{
                        textAlign: "center",
                        padding: "1rem",
                        fontSize: "0.75rem",
                        color: "#cbd5e1",
                        borderTop: "1px solid #f1f5f9",
                        background: "white",
                    }}
                >
                    🎨 DrawTogether · Real-time collaborative drawing
                </footer>
            </div>
        </>
    );
}
