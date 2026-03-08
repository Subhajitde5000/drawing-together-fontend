"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type GameMode = "collab" | "guess";

interface Player {
    id: number;
    name: string;
    isHost: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PLAYERS: Record<GameMode, number> = { collab: 2, guess: 6 };
const MIN_PLAYERS: Record<GameMode, number> = { collab: 2, guess: 2 };
const ROUNDS_OPTIONS = [3, 5, 7, 10];
const TIME_OPTIONS = [60, 70, 90, 120];

const BACKEND_WS =
    process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, "") ?? "ws://localhost:8000";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PlayerRow({
    player,
    isMe,
}: {
    player: Player | null;
    isMe?: boolean;
}) {
    if (!player) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.9rem",
                    padding: "0.85rem 1.25rem",
                    borderRadius: "0.85rem",
                    background: "#f8fafc",
                    border: "1.5px dashed #cbd5e1",
                    color: "#94a3b8",
                    fontSize: "0.92rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-nunito), Nunito, sans-serif",
                }}
            >
                <span style={{ fontSize: "1.3rem", opacity: 0.5 }}>🙂</span>
                <span>Waiting for player…</span>
                <span
                    style={{
                        marginLeft: "auto",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#cbd5e1",
                        animation: "pulse-glow 2s ease-in-out infinite",
                    }}
                />
            </div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "0.9rem",
                padding: "0.85rem 1.25rem",
                borderRadius: "0.85rem",
                background: isMe
                    ? "linear-gradient(135deg, #ede9fe, #d1fae5)"
                    : "white",
                border: isMe ? "1.5px solid #a5b4fc" : "1.5px solid #e2e8f0",
                transition: "all 0.25s ease",
                animation: "fadeInUp 0.35s ease-out forwards",
            }}
        >
            <span style={{ fontSize: "1.35rem" }}>
                {player.isHost ? "👑" : "🙂"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p
                    style={{
                        fontFamily: "var(--font-nunito), Nunito, sans-serif",
                        fontWeight: 800,
                        fontSize: "0.98rem",
                        color: "#0f172a",
                        margin: 0,
                    }}
                >
                    {player.name}
                    {isMe && (
                        <span
                            style={{
                                marginLeft: 8,
                                fontSize: "0.72rem",
                                background: "#6366f1",
                                color: "white",
                                borderRadius: 9999,
                                padding: "2px 8px",
                                fontWeight: 700,
                                verticalAlign: "middle",
                            }}
                        >
                            You
                        </span>
                    )}
                </p>
                <p
                    style={{
                        fontSize: "0.75rem",
                        color: player.isHost ? "#7c3aed" : "#64748b",
                        margin: 0,
                        fontWeight: player.isHost ? 700 : 500,
                    }}
                >
                    {player.isHost ? "Host" : "Player"}
                </p>
            </div>
            <span
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 0 0 rgba(34,197,94,0.4)",
                    animation: "pulse-glow 1.5s ease-in-out infinite",
                }}
            />
        </div>
    );
}

function SelectControl({
    label,
    value,
    options,
    onChange,
    disabled,
    format,
}: {
    label: string;
    value: number;
    options: number[];
    onChange: (v: number) => void;
    disabled: boolean;
    format?: (v: number) => string;
}) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
                flex: "1 1 140px",
            }}
        >
            <label
                style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontFamily: "var(--font-nunito), Nunito, sans-serif",
                }}
            >
                {label}
            </label>
            {disabled ? (
                <div
                    style={{
                        padding: "0.65rem 1rem",
                        background: "#f8fafc",
                        border: "1.5px solid #e2e8f0",
                        borderRadius: "0.65rem",
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        color: "#334155",
                        fontFamily: "var(--font-nunito), Nunito, sans-serif",
                    }}
                >
                    {format ? format(value) : value}
                </div>
            ) : (
                <select
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    style={{
                        padding: "0.65rem 1rem",
                        background: "white",
                        border: "1.5px solid #c7d2fe",
                        borderRadius: "0.65rem",
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        color: "#334155",
                        fontFamily: "var(--font-nunito), Nunito, sans-serif",
                        cursor: "pointer",
                        outline: "none",
                        appearance: "none",
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236366f1' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                        paddingRight: "2rem",
                    }}
                >
                    {options.map((o) => (
                        <option key={o} value={o}>
                            {format ? format(o) : o}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function LobbyPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const roomId = (params.roomId as string).toUpperCase();
    const rawMode = searchParams.get("mode") ?? "collab";
    const mode: GameMode = rawMode === "guess" ? "guess" : "collab";

    const maxPlayers = MAX_PLAYERS[mode];
    const minPlayers = MIN_PLAYERS[mode];

    // ── State ──────────────────────────────────────────────────────────────────
    const [players, setPlayers] = useState<Player[]>([]);
    const [myNumber, setMyNumber] = useState<number | null>(null);
    const [rounds, setRounds] = useState(5);
    const [roundTime, setRoundTime] = useState(70);
    const [copied, setCopied] = useState(false);
    const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "error">("connecting");

    // ── Name entry state ───────────────────────────────────────────────────────
    const [nameInput, setNameInput] = useState("");
    const [myName, setMyName] = useState("");
    const [nameSubmitted, setNameSubmitted] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);

    // ── Helpers ────────────────────────────────────────────────────────────────
    const isHost = myNumber === 1;
    const playerCount = players.length;
    const canStart = playerCount >= minPlayers;

    const inviteUrl =
        typeof window !== "undefined"
            ? `${window.location.origin}/lobby/${roomId}?mode=${mode}`
            : "";

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // fallback
            const el = document.createElement("textarea");
            el.value = inviteUrl;
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }
    }, [inviteUrl]);

    // ── WebSocket (only connects after name is submitted) ───────────────────────
    useEffect(() => {
        if (!nameSubmitted) return;

        const wsUrl = `${BACKEND_WS}/ws/${roomId}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setWsStatus("connected");
            ws.send(JSON.stringify({ type: "join", name: myName }));
        };

        ws.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data);

                if (data.type === "connected") {
                    const num: number = data.player;
                    setMyNumber(num);
                    setPlayers((prev) => {
                        const filtered = prev.filter((p) => p.id !== num);
                        return [
                            ...filtered,
                            { id: num, name: myName, isHost: num === 1 },
                        ].sort((a, b) => a.id - b.id);
                    });
                }

                if (data.type === "player_joined") {
                    const count: number = data.players;
                    setPlayers((prev) => {
                        const newList: Player[] = [];
                        for (let i = 1; i <= count; i++) {
                            const existing = prev.find((p) => p.id === i);
                            newList.push(
                                existing ?? { id: i, name: `Player ${i}`, isHost: i === 1 }
                            );
                        }
                        return newList;
                    });
                }

                if (data.type === "player_left") {
                    const count: number = data.players;
                    setPlayers((prev) => prev.filter((p) => p.id <= count));
                }

                if (data.type === "start_game") {
                    // Non-host player: navigate to the room using settings from host
                    const m = (data.mode ?? mode) as GameMode;
                    const r = data.rounds ?? rounds;
                    const t = data.time ?? roundTime;
                    const encodedName = encodeURIComponent(myName);
                    if (m === "guess") {
                        router.push(`/room/${roomId}/guess?rounds=${r}&time=${t}&name=${encodedName}`);
                    } else {
                        router.push(`/room/${roomId}?mode=${m}&rounds=${r}&time=${t}&name=${encodedName}`);
                    }
                }
            } catch {
                // ignore parse errors
            }
        };

        ws.onerror = () => setWsStatus("error");

        ws.onclose = (ev) => {
            if (ev.code === 4000) {
                router.push("/room-full");
            }
        };

        return () => {
            ws.close();
        };
    }, [roomId, router, nameSubmitted, myName]);

    // ── Start Game ─────────────────────────────────────────────────────────────
    const handleStartGame = () => {
        if (!canStart) return;
        // Broadcast start_game to all other players before navigating
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "start_game", mode, rounds, time: roundTime }));
        }
        // Navigate — WS closes naturally when page unmounts
        const encodedName = encodeURIComponent(myName);
        if (mode === "guess") {
            router.push(`/room/${roomId}/guess?rounds=${rounds}&time=${roundTime}&name=${encodedName}`);
        } else {
            router.push(`/room/${roomId}?mode=${mode}&rounds=${rounds}&time=${roundTime}&name=${encodedName}`);
        }
    };

    const handleLeave = () => {
        wsRef.current?.close();
        router.push("/");
    };

    // ── Name entry submit ───────────────────────────────────────────────────────
    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = nameInput.trim();
        if (!trimmed) return;
        setMyName(trimmed);
        setNameSubmitted(true);
    };

    // ── Name entry screen ──────────────────────────────────────────────────────
    if (!nameSubmitted) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    background: "linear-gradient(160deg, #f0f4ff 0%, #f8fafc 60%, #f0fdf4 100%)",
                    fontFamily: "var(--font-inter), Inter, sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "1.5rem",
                }}
            >
                <style>{`
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                    .name-input:focus {
                        outline: none;
                        border-color: #6366f1 !important;
                        box-shadow: 0 0 0 3px rgba(99,102,241,0.18) !important;
                    }
                    .join-btn:hover:not(:disabled) {
                        transform: translateY(-2px);
                        box-shadow: 0 10px 30px rgba(99,102,241,0.45) !important;
                    }
                    .join-btn:active:not(:disabled) {
                        transform: translateY(0);
                    }
                `}</style>
                <div
                    style={{
                        width: "100%",
                        maxWidth: 420,
                        background: "white",
                        borderRadius: "1.5rem",
                        border: "1.5px solid #e2e8f0",
                        boxShadow: "0 8px 40px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                        padding: "2.5rem 2rem",
                        animation: "fadeInUp 0.4s ease-out",
                    }}
                >
                    {/* Logo */}
                    <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
                        <span style={{ fontSize: "2.8rem", display: "block", marginBottom: "0.5rem" }}>🎨</span>
                        <h1
                            style={{
                                fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                fontWeight: 900,
                                fontSize: "1.55rem",
                                background: "linear-gradient(135deg, #6366f1, #22c55e)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                margin: 0,
                            }}
                        >
                            DrawTogether
                        </h1>
                        <p style={{ margin: "0.4rem 0 0", color: "#64748b", fontSize: "0.9rem", fontWeight: 500 }}>
                            You&apos;re joining room{" "}
                            <strong style={{ color: "#6366f1", letterSpacing: 1.5 }}>{roomId}</strong>
                        </p>
                    </div>

                    <form onSubmit={handleNameSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                            <label
                                htmlFor="player-name-input"
                                style={{
                                    fontSize: "0.8rem",
                                    fontWeight: 700,
                                    color: "#475569",
                                    textTransform: "uppercase",
                                    letterSpacing: 1,
                                    fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                }}
                            >
                                Your Name
                            </label>
                            <input
                                id="player-name-input"
                                className="name-input"
                                type="text"
                                placeholder="Enter your name…"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value.slice(0, 20))}
                                maxLength={20}
                                autoFocus
                                autoComplete="off"
                                style={{
                                    padding: "0.85rem 1.1rem",
                                    fontSize: "1rem",
                                    fontWeight: 600,
                                    fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                    border: "1.5px solid #e2e8f0",
                                    borderRadius: "0.75rem",
                                    background: "#f8fafc",
                                    color: "#0f172a",
                                    transition: "border-color 0.2s, box-shadow 0.2s",
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8", textAlign: "right", fontFamily: "var(--font-nunito), Nunito, sans-serif" }}>
                                {nameInput.length} / 20
                            </span>
                        </div>

                        <button
                            type="submit"
                            className="join-btn"
                            disabled={!nameInput.trim()}
                            style={{
                                padding: "0.9rem",
                                borderRadius: 9999,
                                border: "none",
                                fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                fontWeight: 900,
                                fontSize: "1.05rem",
                                cursor: nameInput.trim() ? "pointer" : "not-allowed",
                                background: nameInput.trim()
                                    ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                                    : "#e2e8f0",
                                color: nameInput.trim() ? "white" : "#94a3b8",
                                boxShadow: nameInput.trim() ? "0 6px 20px rgba(99,102,241,0.35)" : "none",
                                transition: "all 0.2s ease",
                            }}
                        >
                            🚀 Join Room
                        </button>
                    </form>

                    <p
                        style={{
                            marginTop: "1.25rem",
                            textAlign: "center",
                            fontSize: "0.78rem",
                            color: "#94a3b8",
                            fontFamily: "var(--font-nunito), Nunito, sans-serif",
                        }}
                    >
                        Mode:{" "}
                        <strong style={{ color: "#6366f1" }}>
                            {mode === "collab" ? "🎨 Collaborative" : "🧠 Guess the Drawing"}
                        </strong>
                    </p>
                </div>
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div
            style={{
                minHeight: "100vh",
                background: "linear-gradient(160deg, #f0f4ff 0%, #f8fafc 60%, #f0fdf4 100%)",
                fontFamily: "var(--font-inter), Inter, sans-serif",
            }}
        >
            {/* ═══════════════════════════════════════ HEADER */}
            <header
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 50,
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    background: "rgba(248,250,252,0.92)",
                    borderBottom: "1px solid rgba(226,232,240,0.8)",
                }}
            >
                <div
                    style={{
                        maxWidth: 900,
                        margin: "0 auto",
                        padding: "0.85rem 1.5rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                    }}
                >
                    {/* Logo */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
                        <span style={{ fontSize: "1.5rem" }}>🎨</span>
                        <div>
                            <span
                                style={{
                                    fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                    fontWeight: 900,
                                    fontSize: "1.1rem",
                                    background: "linear-gradient(135deg, #6366f1, #22c55e)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    display: "block",
                                    lineHeight: 1.1,
                                }}
                            >
                                DrawTogether
                            </span>
                            <span
                                style={{
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    color: "#94a3b8",
                                    textTransform: "uppercase",
                                    letterSpacing: 1.5,
                                }}
                            >
                                Lobby
                            </span>
                        </div>
                    </div>

                    {/* Room code + copy */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                            background: "white",
                            border: "1.5px solid #e2e8f0",
                            borderRadius: "0.75rem",
                            padding: "0.45rem 0.85rem",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                        }}
                    >
                        <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                            Room Code:
                        </span>
                        <span
                            style={{
                                fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                fontWeight: 900,
                                fontSize: "0.95rem",
                                color: "#6366f1",
                                letterSpacing: 2,
                            }}
                        >
                            {roomId}
                        </span>
                        <button
                            id="copy-room-code-btn"
                            onClick={handleCopy}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                background: copied
                                    ? "linear-gradient(135deg,#d1fae5,#a7f3d0)"
                                    : "linear-gradient(135deg,#ede9fe,#ddd6fe)",
                                color: copied ? "#059669" : "#6366f1",
                                border: "none",
                                borderRadius: "0.5rem",
                                padding: "0.3rem 0.75rem",
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {copied ? "✅ Copied!" : "📋 Copy"}
                        </button>
                    </div>

                    {/* WS status dot */}
                    <div
                        title={wsStatus}
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background:
                                wsStatus === "connected"
                                    ? "#22c55e"
                                    : wsStatus === "error"
                                        ? "#ef4444"
                                        : "#f59e0b",
                            flexShrink: 0,
                            animation: wsStatus === "connecting" ? "pulse-glow 1s ease-in-out infinite" : "none",
                        }}
                    />
                </div>
            </header>

            {/* ═══════════════════════════════════════ MAIN */}
            <main
                style={{
                    maxWidth: 900,
                    margin: "0 auto",
                    padding: "2rem 1.25rem 4rem",
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "1.25rem",
                }}
            >
                {/* ── ROOM INFO CARD ── */}
                <section
                    style={{
                        background: "white",
                        border: "1.5px solid #e2e8f0",
                        borderRadius: "1.25rem",
                        padding: "1.25rem 1.5rem",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "1rem",
                        alignItems: "center",
                        boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
                    }}
                >
                    <InfoPill
                        label="Game Mode"
                        value={mode === "collab" ? "🎨 Collaborative Drawing" : "🧠 Guess The Drawing"}
                        accent="#6366f1"
                    />
                    <InfoPill
                        label="Players"
                        value={`${playerCount} / ${maxPlayers}`}
                        accent="#22c55e"
                    />
                    {mode === "guess" && (
                        <>
                            <InfoPill label="Rounds" value={`${rounds}`} accent="#f59e0b" />
                            <InfoPill label="Round Time" value={`${roundTime}s`} accent="#3b82f6" />
                        </>
                    )}
                </section>

                {/* ── TWO COLUMN (Players + Settings) ── */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: "1.25rem",
                    }}
                >
                    {/* Players Section */}
                    <section
                        style={{
                            background: "white",
                            border: "1.5px solid #e2e8f0",
                            borderRadius: "1.25rem",
                            padding: "1.5rem",
                            boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "1.1rem",
                            }}
                        >
                            <h2
                                style={{
                                    fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                    fontWeight: 900,
                                    fontSize: "1.1rem",
                                    color: "#0f172a",
                                    margin: 0,
                                }}
                            >
                                👥 Players in Room
                            </h2>
                            <span
                                style={{
                                    background:
                                        playerCount >= minPlayers
                                            ? "linear-gradient(135deg,#d1fae5,#a7f3d0)"
                                            : "linear-gradient(135deg,#fff7ed,#fed7aa)",
                                    color: playerCount >= minPlayers ? "#059669" : "#c2410c",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    borderRadius: 9999,
                                    padding: "3px 12px",
                                }}
                            >
                                {playerCount >= minPlayers ? "✅ Ready" : `⏳ Need ${minPlayers - playerCount} more`}
                            </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            {Array.from({ length: maxPlayers }).map((_, i) => {
                                const p = players[i] ?? null;
                                return (
                                    <PlayerRow
                                        key={i}
                                        player={p}
                                        isMe={p?.id === myNumber}
                                    />
                                );
                            })}
                        </div>

                        {/* Invite nudge */}
                        {playerCount < maxPlayers && (
                            <div
                                style={{
                                    marginTop: "1rem",
                                    padding: "0.85rem 1rem",
                                    background: "linear-gradient(135deg,#ede9fe,#f0f9ff)",
                                    borderRadius: "0.75rem",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.7rem",
                                }}
                            >
                                <span style={{ fontSize: "1.2rem" }}>🔗</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p
                                        style={{
                                            fontSize: "0.82rem",
                                            fontWeight: 700,
                                            color: "#4f46e5",
                                            margin: 0,
                                        }}
                                    >
                                        Share the room link to invite friends!
                                    </p>
                                    <p
                                        style={{
                                            fontSize: "0.75rem",
                                            color: "#6366f1",
                                            margin: 0,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            opacity: 0.8,
                                        }}
                                    >
                                        {inviteUrl}
                                    </p>
                                </div>
                                <button
                                    onClick={handleCopy}
                                    style={{
                                        background: "#6366f1",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "0.5rem",
                                        padding: "0.4rem 0.9rem",
                                        fontSize: "0.78rem",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                        whiteSpace: "nowrap",
                                        flexShrink: 0,
                                    }}
                                >
                                    {copied ? "✅" : "📋 Copy Link"}
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Game Settings (guess mode only) */}
                    {mode === "guess" && (
                        <section
                            style={{
                                background: "white",
                                border: "1.5px solid #e2e8f0",
                                borderRadius: "1.25rem",
                                padding: "1.5rem",
                                boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    marginBottom: "1.1rem",
                                }}
                            >
                                <h2
                                    style={{
                                        fontFamily: "var(--font-nunito), Nunito, sans-serif",
                                        fontWeight: 900,
                                        fontSize: "1.1rem",
                                        color: "#0f172a",
                                        margin: 0,
                                    }}
                                >
                                    ⚙️ Game Settings
                                </h2>
                                {!isHost && (
                                    <span
                                        style={{
                                            fontSize: "0.72rem",
                                            color: "#94a3b8",
                                            fontWeight: 600,
                                            marginLeft: 4,
                                        }}
                                    >
                                        (Host only)
                                    </span>
                                )}
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                                <SelectControl
                                    label="Rounds"
                                    value={rounds}
                                    options={ROUNDS_OPTIONS}
                                    onChange={setRounds}
                                    disabled={!isHost}
                                />
                                <SelectControl
                                    label="Round Time"
                                    value={roundTime}
                                    options={TIME_OPTIONS}
                                    onChange={setRoundTime}
                                    disabled={!isHost}
                                    format={(v) => `${v}s`}
                                />
                            </div>

                            {!isHost && (
                                <p
                                    style={{
                                        marginTop: "0.9rem",
                                        fontSize: "0.8rem",
                                        color: "#94a3b8",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        margin: "0.9rem 0 0",
                                    }}
                                >
                                    <span>👑</span> Only the host can change settings.
                                </p>
                            )}
                        </section>
                    )}
                </div>

                {/* ── LOBBY ACTIONS + START GAME ── */}
                <section
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                    }}
                >
                    {/* Leave */}
                    <button
                        id="leave-room-btn"
                        onClick={handleLeave}
                        style={{
                            alignSelf: "flex-start",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "white",
                            border: "1.5px solid #fecaca",
                            color: "#ef4444",
                            borderRadius: 9999,
                            padding: "0.55rem 1.25rem",
                            fontSize: "0.88rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "var(--font-nunito), Nunito, sans-serif",
                            transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "#fef2f2";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = "white";
                            (e.currentTarget as HTMLButtonElement).style.borderColor = "#fecaca";
                        }}
                    >
                        🚪 Leave Room
                    </button>

                    {/* Start Game — full width, prominent */}
                    <button
                        id="start-game-btn"
                        onClick={handleStartGame}
                        disabled={!canStart || !isHost}
                        style={{
                            width: "100%",
                            padding: "1.15rem 2rem",
                            borderRadius: 9999,
                            border: "none",
                            fontFamily: "var(--font-nunito), Nunito, sans-serif",
                            fontWeight: 900,
                            fontSize: "1.2rem",
                            cursor: canStart && isHost ? "pointer" : "not-allowed",
                            transition: "all 0.25s ease",
                            background:
                                canStart && isHost
                                    ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #7c3aed 100%)"
                                    : "#e2e8f0",
                            color: canStart && isHost ? "white" : "#94a3b8",
                            boxShadow:
                                canStart && isHost
                                    ? "0 8px 30px rgba(99,102,241,0.45)"
                                    : "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                        }}
                        onMouseEnter={(e) => {
                            if (canStart && isHost) {
                                (e.currentTarget as HTMLButtonElement).style.transform =
                                    "translateY(-2px) scale(1.01)";
                                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                                    "0 14px 40px rgba(99,102,241,0.55)";
                            }
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.transform = "none";
                            (e.currentTarget as HTMLButtonElement).style.boxShadow =
                                canStart && isHost
                                    ? "0 8px 30px rgba(99,102,241,0.45)"
                                    : "none";
                        }}
                    >
                        {!isHost ? (
                            <>⏳ Waiting for host to start…</>
                        ) : canStart ? (
                            <>🚀 Start Game</>
                        ) : (
                            <>⏳ Waiting for players… ({playerCount}/{minPlayers})</>
                        )}
                    </button>

                    {isHost && !canStart && (
                        <p
                            style={{
                                textAlign: "center",
                                fontSize: "0.82rem",
                                color: "#94a3b8",
                                margin: 0,
                            }}
                        >
                            Need at least {minPlayers} players to start.{" "}
                            <button
                                onClick={handleCopy}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "#6366f1",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    fontSize: "0.82rem",
                                    padding: 0,
                                    textDecoration: "underline",
                                }}
                            >
                                Copy invite link
                            </button>
                        </p>
                    )}
                </section>
            </main>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// InfoPill
// ─────────────────────────────────────────────────────────────────────────────

function InfoPill({
    label,
    value,
    accent,
}: {
    label: string;
    value: string;
    accent: string;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            <span
                style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "#94a3b8",
                    fontFamily: "var(--font-nunito), Nunito, sans-serif",
                }}
            >
                {label}
            </span>
            <span
                style={{
                    fontSize: "0.9rem",
                    fontWeight: 800,
                    color: accent,
                    fontFamily: "var(--font-nunito), Nunito, sans-serif",
                }}
            >
                {value}
            </span>
        </div>
    );
}
