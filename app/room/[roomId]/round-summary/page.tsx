"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const COUNTDOWN_SEC = 6;

export default function RoundSummaryPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const roomId = (params.roomId as string).toUpperCase();

    // ── Parse query params passed from guess page ──
    const word        = searchParams.get("word") ?? "?";
    const round       = parseInt(searchParams.get("round") ?? "1", 10);
    const totalRounds = parseInt(searchParams.get("rounds") ?? "5", 10);
    const roundTime   = parseInt(searchParams.get("time") ?? "70", 10);
    const name        = searchParams.get("name") ?? "Player";
    const drawerName  = searchParams.get("drawer") ?? "?";
    const isFinal     = searchParams.get("final") === "1";

    // scores  →  "Alice:35,Emma:20,Bob:10"
    const scores: { name: string; score: number }[] = (searchParams.get("scores") ?? "")
        .split(",")
        .filter(Boolean)
        .map(s => { const [n, v] = s.split(":"); return { name: n, score: parseInt(v ?? "0", 10) }; })
        .sort((a, b) => b.score - a.score);

    // correct →  "Emma,Bob"
    const correct: string[] = (searchParams.get("correct") ?? "")
        .split(",")
        .filter(Boolean);

    const [countdown, setCountdown] = useState(COUNTDOWN_SEC);

    // ── Auto-navigate after countdown ──
    useEffect(() => {
        if (countdown <= 0) {
            if (isFinal) {
                router.push(`/room/${roomId}?mode=guess&final=1&name=${encodeURIComponent(name)}`);
            } else {
                router.push(
                    `/room/${roomId}/guess?rounds=${totalRounds}&time=${roundTime}&name=${encodeURIComponent(name)}`
                );
            }
            return;
        }
        const id = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(id);
    }, [countdown, isFinal, roomId, totalRounds, roundTime, name, router]);

    const rankEmoji = (i: number) =>
        i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}th`;

    const rankSuffix = (i: number) =>
        i === 0 ? "" : i === 1 ? "" : i === 2 ? "" : "";

    return (
        <>
            <style>{`
                @keyframes popIn {
                    0%   { opacity: 0; transform: scale(0.75); }
                    65%  { transform: scale(1.06); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes tickDown {
                    0%   { transform: scale(1.3); opacity: 0.7; }
                    100% { transform: scale(1);   opacity: 1; }
                }
                @keyframes shimmer {
                    0%   { background-position: -200% center; }
                    100% { background-position:  200% center; }
                }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                html, body { height: 100%; background: #f0f4ff; }
                .section-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 1.25rem;
                    padding: 1.5rem 1.75rem;
                    box-shadow: 0 2px 16px rgba(0,0,0,0.05);
                    animation: fadeUp 0.45s ease-out both;
                }
                .word-reveal {
                    font-size: clamp(2.4rem, 7vw, 4rem);
                    font-weight: 900;
                    letter-spacing: 0.15em;
                    background: linear-gradient(135deg, #6366f1 0%, #22c55e 100%);
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: popIn 0.55s ease-out both, shimmer 3s linear infinite;
                }
                .player-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 0.6rem 0.85rem;
                    border-radius: 0.75rem;
                    animation: fadeUp 0.4s ease-out both;
                }
                .countdown-ring {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    border: 5px solid #e2e8f0;
                    border-top-color: #6366f1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: tickDown 0.45s ease-out;
                    position: relative;
                }
                .countdown-ring svg {
                    position: absolute;
                    inset: -5px;
                    width: calc(100% + 10px);
                    height: calc(100% + 10px);
                    transform: rotate(-90deg);
                }
                @media (max-width: 600px) {
                    .section-card { padding: 1.1rem 1rem; }
                }
            `}</style>

            <div style={{
                minHeight: "100vh",
                background: "linear-gradient(160deg,#f0f4ff 0%,#f8fafc 55%,#f0fdf4 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "1.5rem 1rem 3rem",
                fontFamily: "var(--font-inter,Inter),sans-serif",
                overflowY: "auto",
            }}>
                {/* ── Header ── */}
                <div style={{ textAlign: "center", marginBottom: "1.75rem", animation: "fadeUp 0.3s ease-out" }}>
                    <div style={{ fontSize: "2.8rem", marginBottom: 4 }}>🎉</div>
                    <h1 style={{
                        fontFamily: "var(--font-nunito,Nunito),sans-serif",
                        fontWeight: 900,
                        fontSize: "clamp(1.6rem,5vw,2.4rem)",
                        color: "#0f172a",
                        letterSpacing: -0.5,
                    }}>
                        Round {round} Complete
                    </h1>
                    <p style={{ fontSize: "0.9rem", color: "#64748b", marginTop: 4 }}>
                        Let&apos;s see who guessed it!
                    </p>
                </div>

                <div style={{ width: "100%", maxWidth: 540, display: "flex", flexDirection: "column", gap: "1rem" }}>

                    {/* ── Word Reveal ── */}
                    <div className="section-card" style={{ textAlign: "center", animationDelay: "0.05s" }}>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
                            The Word Was
                        </p>
                        <div className="word-reveal">{word.toUpperCase()}</div>
                    </div>

                    {/* ── Correct Guesses ── */}
                    <div className="section-card" style={{ animationDelay: "0.12s" }}>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
                            Correct Guesses
                        </p>
                        {correct.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "0.75rem 0", color: "#94a3b8", fontSize: "0.85rem" }}>
                                Nobody guessed it this round 😅
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {correct.map((p, i) => (
                                    <div
                                        key={p}
                                        className="player-row"
                                        style={{
                                            background: "rgba(34,197,94,0.08)",
                                            border: "1px solid rgba(34,197,94,0.25)",
                                            animationDelay: `${0.14 + i * 0.07}s`,
                                        }}
                                    >
                                        <span style={{ fontSize: "1rem" }}>✅</span>
                                        <span style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 700, fontSize: "0.92rem", color: "#0f172a", flex: 1 }}>{p}</span>
                                        <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#16a34a" }}>+10</span>
                                    </div>
                                ))}
                                {/* Players who didn't guess */}
                                {scores
                                    .filter(s => s.name !== drawerName && !correct.includes(s.name))
                                    .map((p, i) => (
                                        <div
                                            key={p.name}
                                            className="player-row"
                                            style={{
                                                background: "#f8fafc",
                                                border: "1px solid #f1f5f9",
                                                animationDelay: `${0.14 + (correct.length + i) * 0.07}s`,
                                            }}
                                        >
                                            <span style={{ fontSize: "1rem" }}>❌</span>
                                            <span style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 600, fontSize: "0.88rem", color: "#64748b", flex: 1 }}>{p.name}</span>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* ── Drawer Info ── */}
                    <div className="section-card" style={{ animationDelay: "0.18s" }}>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
                            Drawer
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.6rem 0.85rem", borderRadius: "0.75rem", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                            <span style={{ fontSize: "1.1rem" }}>✏️</span>
                            <span style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 800, fontSize: "0.95rem", color: "#4f46e5", flex: 1 }}>{drawerName}</span>
                            {correct.length > 0 && (
                                <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#6366f1" }}>
                                    +{Math.min(correct.length * 5, 20)} pts
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── Scoreboard ── */}
                    <div className="section-card" style={{ animationDelay: "0.22s" }}>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
                            Scoreboard
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {scores.map((p, i) => {
                                const isFirst = i === 0;
                                return (
                                    <div
                                        key={p.name}
                                        className="player-row"
                                        style={{
                                            background: isFirst ? "rgba(251,191,36,0.1)" : i === 1 ? "rgba(148,163,184,0.1)" : i === 2 ? "rgba(180,120,60,0.08)" : "#f8fafc",
                                            border: isFirst ? "1px solid rgba(251,191,36,0.35)" : i === 1 ? "1px solid rgba(148,163,184,0.3)" : i === 2 ? "1px solid rgba(180,120,60,0.2)" : "1px solid #f1f5f9",
                                            animationDelay: `${0.24 + i * 0.06}s`,
                                        }}
                                    >
                                        <span style={{ fontSize: "1.1rem", minWidth: 28, textAlign: "center" }}>
                                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8" }}>{i + 1}th</span>}
                                        </span>
                                        <span style={{
                                            fontFamily: "var(--font-nunito,Nunito),sans-serif",
                                            fontWeight: 700,
                                            fontSize: "0.92rem",
                                            color: p.name === name ? "#4f46e5" : "#0f172a",
                                            flex: 1,
                                        }}>
                                            {p.name}{p.name === name && <span style={{ fontSize: "0.72rem", color: "#6366f1", marginLeft: 5 }}>(you)</span>}
                                        </span>
                                        <span style={{
                                            fontWeight: 900,
                                            fontSize: "1rem",
                                            color: isFirst ? "#d97706" : i === 1 ? "#64748b" : i === 2 ? "#92400e" : "#475569",
                                        }}>
                                            {p.score}
                                        </span>
                                    </div>
                                );
                            })}

                            {scores.length === 0 && (
                                <div style={{ color: "#94a3b8", fontSize: "0.82rem", textAlign: "center", padding: "0.5rem 0" }}>No scores yet</div>
                            )}
                        </div>
                    </div>

                    {/* ── Countdown ── */}
                    <div className="section-card" style={{ textAlign: "center", animationDelay: "0.28s" }}>
                        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>
                            {isFinal ? "Game Over — Redirecting" : "Next Round Starting In"}
                        </p>

                        {/* SVG ring countdown */}
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <div style={{ position: "relative", width: 88, height: 88 }} key={countdown}>
                                <svg
                                    viewBox="0 0 88 88"
                                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "rotate(-90deg)" }}
                                >
                                    {/* track */}
                                    <circle cx="44" cy="44" r="38" fill="none" stroke="#e2e8f0" strokeWidth="7" />
                                    {/* progress */}
                                    <circle
                                        cx="44"
                                        cy="44"
                                        r="38"
                                        fill="none"
                                        stroke="#6366f1"
                                        strokeWidth="7"
                                        strokeLinecap="round"
                                        strokeDasharray={`${2 * Math.PI * 38}`}
                                        strokeDashoffset={`${2 * Math.PI * 38 * (1 - countdown / COUNTDOWN_SEC)}`}
                                        style={{ transition: "stroke-dashoffset 0.9s linear" }}
                                    />
                                </svg>
                                <div style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontFamily: "var(--font-nunito,Nunito),sans-serif",
                                    fontWeight: 900,
                                    fontSize: "2rem",
                                    color: "#0f172a",
                                    animation: "tickDown 0.45s ease-out",
                                }}>
                                    {countdown}
                                </div>
                            </div>
                        </div>

                        <p style={{ marginTop: 12, fontSize: "0.78rem", color: "#94a3b8" }}>
                            {isFinal ? "Heading to the final screen…" : `Round ${round + 1} of ${totalRounds} coming up`}
                        </p>
                    </div>

                </div>
            </div>
        </>
    );
}
