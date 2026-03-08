"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ToolName = "pen" | "eraser" | "spray" | "fill";

interface Player {
    id: number;
    name: string;
    score: number;
    isDrawing: boolean;
    isHost: boolean;
}

interface ChatMessage {
    id: number;
    playerId: number;
    playerName: string;
    text: string;
    isCorrect: boolean;
    isSystem: boolean;
}

interface RoundOverData {
    word: string;
    correctGuessers: string[];
    scores: { name: string; score: number }[];
}

type WsStatus = "connecting" | "connected" | "disconnected";

// ─────────────────────────────────────────────────────────────────────────────
// Canvas helpers (standalone so they never change reference)
// ─────────────────────────────────────────────────────────────────────────────

function getCoords(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ("touches" in e) {
        const t = e.touches[0] || e.changedTouches[0];
        return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
}

function hexToRgb(hex: string) {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    };
}

function applyLine(
    ctx: CanvasRenderingContext2D,
    fx: number, fy: number, tx: number, ty: number,
    color: string, size: number
) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
}

function applySpray(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number) {
    const r = size * 4;
    const { r: cr, g: cg, b: cb } = hexToRgb(color);
    ctx.save();
    for (let i = 0; i < Math.max(30, size * 5); i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * r;
        const alpha = (1 - d / r) * 0.4 + 0.05;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.beginPath();
        ctx.arc(x + d * Math.cos(a), y + d * Math.sin(a), Math.random() * (size / 3) + 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function applyFloodFill(
    ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement,
    sx: number, sy: number, fillColor: string
) {
    const w = canvas.width, h = canvas.height;
    const rfCtx = canvas.getContext("2d", { willReadFrequently: true })!;
    const imgData = rfCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const idx = (x: number, y: number) => (y * w + x) * 4;
    const si = idx(Math.round(sx), Math.round(sy));
    const [tr, tg, tb, ta] = [data[si], data[si + 1], data[si + 2], data[si + 3]];
    const fill = hexToRgb(fillColor);
    if (fill.r === tr && fill.g === tg && fill.b === tb && ta === 255) return;
    const match = (i: number) =>
        Math.abs(data[i] - tr) < 32 && Math.abs(data[i + 1] - tg) < 32 &&
        Math.abs(data[i + 2] - tb) < 32 && Math.abs(data[i + 3] - ta) < 32;
    const stack: [number, number][] = [[Math.round(sx), Math.round(sy)]];
    const visited = new Uint8Array(w * h);
    visited[Math.round(sy) * w + Math.round(sx)] = 1;
    while (stack.length) {
        const [cx, cy] = stack.pop()!;
        const ci = idx(cx, cy);
        data[ci] = fill.r; data[ci + 1] = fill.g; data[ci + 2] = fill.b; data[ci + 3] = 255;
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const ni = ny * w + nx;
            if (!visited[ni] && match(idx(nx, ny))) { visited[ni] = 1; stack.push([nx, ny]); }
        }
    }
    ctx.putImageData(imgData, 0, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dummy word list (real game would get these from backend)
// ─────────────────────────────────────────────────────────────────────────────

const WORD_LIST = [
    "tree", "house", "cat", "dog", "sun", "moon", "star", "bird", "fish",
    "apple", "book", "car", "boat", "cloud", "fire", "flower", "guitar",
    "heart", "kite", "lamp", "lion", "mountain", "ocean", "pizza", "rain",
    "rainbow", "robot", "rocket", "snake", "snowman", "spider", "sword",
    "tiger", "train", "umbrella", "whale", "witch", "wolf", "zebra",
];

function pickWord() {
    return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}

function maskWord(word: string, revealed: number[]): string {
    return word.split("").map((c, i) => (c === " " ? "　" : revealed.includes(i) ? c.toUpperCase() : "_")).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = ["#0f172a", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#ffffff"];
const BRUSH_SIZES = [3, 6, 12, 24];

const BACKEND_WS =
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_WS_URL : undefined)
        ?.replace(/\/$/, "") ?? "ws://localhost:8000";

export default function GuessGamePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const roomId = (params.roomId as string).toUpperCase();
    const totalRounds = parseInt(searchParams.get("rounds") ?? "5", 10);
    const roundTime = parseInt(searchParams.get("time") ?? "70", 10);
    const myNameParam = searchParams.get("name") ?? "Player";

    // ── Canvas refs ──
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const guessInputRef = useRef<HTMLInputElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const canvasCardRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef<(e: TouchEvent) => void>(() => {});
    const touchMoveRef = useRef<(e: TouchEvent) => void>(() => {});
    const touchEndRef = useRef<(e: TouchEvent) => void>(() => {});

    // ── Game state ──
    const [myId, setMyId] = useState<number | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [chat, setChat] = useState<ChatMessage[]>([]);
    const [guessInput, setGuessInput] = useState("");
    const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");

    // ── Round state ──
    const [currentRound, setCurrentRound] = useState(1);
    const [drawerId, setDrawerId] = useState<number | null>(null);
    const [secretWord, setSecretWord] = useState("");           // only drawer knows
    const [wordHint, setWordHint] = useState("");               // masked word for guessers
    const [revealedLetters, setRevealedLetters] = useState<number[]>([]);
    const [timeLeft, setTimeLeft] = useState(roundTime);
    const [roundPhase, setRoundPhase] = useState<"waiting" | "drawing" | "roundover">("waiting");
    const [roundOverData, setRoundOverData] = useState<RoundOverData | null>(null);
    const [correctGuessers, setCorrectGuessers] = useState<string[]>([]);

    // ── Tool state ──
    const [activeTool, setActiveTool] = useState<ToolName>("pen");
    const [color, setColor] = useState("#0f172a");
    const [brushSize, setBrushSize] = useState(6);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [fsChatOpen, setFsChatOpen] = useState(false);
    const [fsToolsOpen, setFsToolsOpen] = useState(false);

    const isDrawer = myId !== null && drawerId === myId;
    const amIWaiting = roundPhase === "waiting";

    // ── Canvas init ──
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctxRef.current = ctx;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    // ── Auto-scroll chat ──
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chat]);

    // ── WebSocket ──
    useEffect(() => {
        const ws = new WebSocket(`${BACKEND_WS}/ws/${roomId}`);
        wsRef.current = ws;
        setWsStatus("connecting");

        ws.onopen = () => {
            setWsStatus("connected");
            ws.send(JSON.stringify({ type: "join", name: myNameParam }));
        };
        ws.onerror = () => setWsStatus("disconnected");
        ws.onclose = () => setWsStatus("disconnected");

        ws.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data);
                handleServerMessage(data);
            } catch { /* ignore */ }
        };

        return () => { ws.close(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    function wsSend(obj: object) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(obj));
        }
    }

    // ── Server message handler ──
    const handleServerMessage = useCallback((data: Record<string, unknown>) => {
        if (data.type === "connected") {
            const num = data.player as number;
            setMyId(num);
            setPlayers(prev => {
                const filtered = prev.filter(p => p.id !== num);
                return [...filtered, { id: num, name: myNameParam, score: 0, isDrawing: false, isHost: num === 1 }]
                    .sort((a, b) => a.id - b.id);
            });
            // Tell server we're ready so it can start the round
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "ready", rounds: totalRounds, time: roundTime }));
            }
        }

        if (data.type === "player_joined") {
            const pList = data.playerList as { id: number; name: string; score: number }[] | undefined;
            if (pList) {
                setPlayers(pList.map(p => ({
                    id: p.id, name: p.name, score: p.score,
                    isDrawing: false, isHost: p.id === 1,
                })));
            } else {
                const count = data.players as number;
                setPlayers(prev => {
                    const list: Player[] = [];
                    for (let i = 1; i <= count; i++) {
                        const ex = prev.find(pp => pp.id === i);
                        list.push(ex ?? { id: i, name: `Player ${i}`, score: 0, isDrawing: false, isHost: i === 1 });
                    }
                    return list;
                });
            }
        }

        if (data.type === "player_left") {
            setPlayers(prev => prev.filter(p => p.id <= (data.players as number)));
        }

        // ── Game state sync (sent on reconnect) ──
        if (data.type === "game_state") {
            const phase = data.phase as string;
            const round = data.round as number;
            const drawerIdVal = data.drawer as number | null;
            const drawerNameVal = data.drawerName as string;
            const tl = data.timeLeft as number;
            const scores = data.scores as { id: number; name: string; score: number }[];
            const guessers = data.correctGuessers as string[] ?? [];

            setCurrentRound(round);
            setDrawerId(drawerIdVal);
            setCorrectGuessers(guessers);
            setTimeLeft(tl);

            if (scores) {
                setPlayers(scores.map(s => ({
                    id: s.id, name: s.name, score: s.score,
                    isDrawing: s.id === drawerIdVal, isHost: s.id === 1,
                })));
            }

            if (phase === "drawing") {
                setRoundPhase("drawing");
                if (data.word) {
                    const word = data.word as string;
                    setSecretWord(word);
                    setWordHint(word.toUpperCase());
                } else {
                    setSecretWord("");
                    setWordHint(data.mask as string ?? "_ _ _ _");
                }

                // Replay drawing history to restore canvas
                const history = data.drawHistory as Record<string, unknown>[] | undefined;
                if (history && history.length > 0) {
                    const canvas = canvasRef.current;
                    const ctx = ctxRef.current;
                    if (canvas && ctx) {
                        for (const cmd of history) {
                            if (cmd.type === "clear") {
                                ctx.fillStyle = "#ffffff";
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                            } else if (cmd.type === "fill") {
                                applyFloodFill(ctx, canvas, cmd.x as number, cmd.y as number, cmd.color as string);
                            } else if (cmd.type === "draw" && cmd.fromX !== undefined) {
                                const tool = cmd.tool as string ?? "pen";
                                if (tool === "spray") {
                                    applySpray(ctx, cmd.x as number, cmd.y as number, cmd.color as string, cmd.size as number);
                                } else {
                                    applyLine(ctx, cmd.fromX as number, cmd.fromY as number, cmd.x as number, cmd.y as number, cmd.color as string, cmd.size as number);
                                }
                            }
                        }
                    }
                }

                addSystemMsg(`Reconnected — Round ${round}, ${drawerNameVal} is drawing.`);
            } else if (phase === "roundover") {
                setRoundPhase("roundover");
                addSystemMsg(`Reconnected — waiting for next round.`);
            } else {
                setRoundPhase("waiting");
                addSystemMsg(`Reconnected — waiting for round to start.`);
            }
        }

        if (data.type === "round_start") {
            const drawerIdVal = data.drawer as number;
            const round = data.round as number;
            setCurrentRound(round);
            setDrawerId(drawerIdVal);
            setCorrectGuessers([]);
            setRoundPhase("drawing");
            setRevealedLetters([]);
            setTimeLeft(roundTime);

            if (data.word) {
                // I am the drawer
                const word = data.word as string;
                setSecretWord(word);
                setWordHint(word.toUpperCase());
            } else {
                // Guesser — get masked hint
                setSecretWord("");
                const mask = data.mask as string ?? "_ _ _ _";
                setWordHint(mask);
            }

            setPlayers(prev => prev.map(p => ({ ...p, isDrawing: p.id === drawerIdVal })));
            clearCanvas();
            addSystemMsg(`Round ${round} started — ${data.drawerName ?? `Player ${drawerIdVal}`} is drawing!`);
        }

        if (data.type === "hint") {
            // Only guessers update their hint — drawer keeps the full word
            if (!isDrawer) {
                setWordHint(data.mask as string);
            }
        }

        if (data.type === "correct_guess") {
            const guesser = data.playerName as string;
            const pts = data.points as number;
            setCorrectGuessers(prev => [...prev, guesser]);
            setPlayers(prev => prev.map(p =>
                p.name === guesser ? { ...p, score: p.score + pts } : p
            ));
            addSystemMsg(`✅ ${guesser} guessed the word! (+${pts} pts)`, true);
        }

        if (data.type === "round_over") {
            if (timerRef.current) clearInterval(timerRef.current);
            const scores = (data.scores as { name: string; score: number }[]) ?? [];
            const isFinal = !!data.isFinal;
            setPlayers(prev => prev.map(p => {
                const s = scores.find(x => x.name === p.name);
                return s ? { ...p, score: s.score } : p;
            }));

            if (isFinal) {
                // Last round — navigate to round-summary with final scores
                setRoundOverData({
                    word: data.word as string ?? secretWord,
                    correctGuessers: data.correctGuessers as string[] ?? correctGuessers,
                    scores,
                });
                setRoundPhase("roundover");
            } else {
                // Mid-game — show brief word banner, next round auto-starts from server
                setRoundPhase("roundover");
                setRoundOverData(null);
                setWordHint((data.word as string ?? "").toUpperCase());
                addSystemMsg(`Round over! The word was: ${(data.word as string ?? "").toUpperCase()}`);
            }
        }

        if (data.type === "timer") {
            setTimeLeft(data.seconds as number);
        }

        if (data.type === "draw" && data.fromX !== undefined) {
            const canvas = canvasRef.current;
            const ctx = ctxRef.current;
            if (!canvas || !ctx) return;
            const tool = data.tool as string ?? "pen";
            if (tool === "spray") applySpray(ctx, data.x as number, data.y as number, data.color as string, data.size as number);
            else applyLine(ctx, data.fromX as number, data.fromY as number, data.x as number, data.y as number, data.color as string, data.size as number);
        }

        if (data.type === "fill") {
            const canvas = canvasRef.current;
            const ctx = ctxRef.current;
            if (!canvas || !ctx) return;
            applyFloodFill(ctx, canvas, data.x as number, data.y as number, data.color as string);
        }

        if (data.type === "clear") {
            clearCanvas();
        }

        if (data.type === "chat") {
            addChatMsg(data.playerId as number, data.playerName as string, data.text as string, false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myNameParam, roundTime, secretWord, correctGuessers]);

    // ── Local timer (counts down when drawing phase) ──
    useEffect(() => {
        if (roundPhase !== "drawing") return;
        if (timerRef.current) clearInterval(timerRef.current);
        const start = timeLeft;
        let count = start;
        timerRef.current = setInterval(() => {
            count -= 1;
            setTimeLeft(count);
            if (count <= 0) {
                clearInterval(timerRef.current!);
            }
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roundPhase]);

    // ── Chat helpers ──
    let msgIdCounter = useRef(0);

    function addChatMsg(playerId: number, name: string, text: string, isCorrect: boolean) {
        msgIdCounter.current += 1;
        setChat(prev => [...prev, { id: msgIdCounter.current, playerId, playerName: name, text, isCorrect, isSystem: false }]);
    }

    function addSystemMsg(text: string, isCorrect = false) {
        msgIdCounter.current += 1;
        setChat(prev => [...prev, { id: msgIdCounter.current, playerId: 0, playerName: "System", text, isCorrect, isSystem: true }]);
    }

    // ── Canvas clear ──
    function clearCanvas() {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // ── Drawing ──
    function startDraw(e: React.MouseEvent | React.TouchEvent) {
        e.preventDefault();
        if (!isDrawer) return;
        isDrawingRef.current = true;
        lastPosRef.current = getCoords(e, canvasRef.current!);
    }

    function draw(e: React.MouseEvent | React.TouchEvent) {
        if (!isDrawer || !isDrawingRef.current) return;
        e.preventDefault();
        const canvas = canvasRef.current!;
        const ctx = ctxRef.current!;
        const pos = getCoords(e, canvas);
        const from = lastPosRef.current ?? pos;
        const activeColor = activeTool === "eraser" ? "#ffffff" : color;
        const activeSize = activeTool === "eraser" ? Math.max(brushSize * 3, 20) : brushSize;

        if (activeTool === "spray") {
            applySpray(ctx, pos.x, pos.y, activeColor, activeSize);
            wsSend({ type: "draw", x: pos.x, y: pos.y, fromX: from.x, fromY: from.y, color: activeColor, size: activeSize, tool: "spray" });
        } else {
            applyLine(ctx, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            wsSend({ type: "draw", x: pos.x, y: pos.y, fromX: from.x, fromY: from.y, color: activeColor, size: activeSize, tool: "pen" });
        }
        lastPosRef.current = pos;
    }

    function endDraw(e: React.MouseEvent | React.TouchEvent) {
        e.preventDefault();
        if (!isDrawer) return;
        isDrawingRef.current = false;
        lastPosRef.current = null;
        wsSend({ type: "end" });
        // On touch, fire fill since click doesn't fire after preventDefault
        if ("touches" in e || "changedTouches" in e) {
            handleCanvasClick(e as unknown as React.MouseEvent);
        }
    }

    // Keep touch handler refs up-to-date (closures change each render)
    touchStartRef.current = (e: TouchEvent) => startDraw(e as unknown as React.TouchEvent);
    touchMoveRef.current = (e: TouchEvent) => draw(e as unknown as React.TouchEvent);
    touchEndRef.current = (e: TouchEvent) => endDraw(e as unknown as React.TouchEvent);

    // Register non-passive touch listeners so preventDefault works on mobile
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onStart = (e: TouchEvent) => touchStartRef.current(e);
        const onMove  = (e: TouchEvent) => touchMoveRef.current(e);
        const onEnd   = (e: TouchEvent) => touchEndRef.current(e);
        canvas.addEventListener("touchstart", onStart, { passive: false });
        canvas.addEventListener("touchmove",  onMove,  { passive: false });
        canvas.addEventListener("touchend",   onEnd,   { passive: false });
        return () => {
            canvas.removeEventListener("touchstart", onStart);
            canvas.removeEventListener("touchmove",  onMove);
            canvas.removeEventListener("touchend",   onEnd);
        };
    }, []);

    function handleCanvasClick(e: React.MouseEvent) {
        if (!isDrawer || activeTool !== "fill") return;
        const canvas = canvasRef.current!;
        const ctx = ctxRef.current!;
        const pos = getCoords(e, canvas);
        applyFloodFill(ctx, canvas, pos.x, pos.y, color);
        wsSend({ type: "fill", x: pos.x, y: pos.y, color });
    }

    function handleClearCanvas() {
        if (!isDrawer) return;
        clearCanvas();
        wsSend({ type: "clear" });
    }

    // ── Fullscreen ──
    function toggleFullscreen() {
        const el = canvasCardRef.current;
        if (!el) return;
        if (!document.fullscreenElement) {
            el.requestFullscreen?.();
            // Lock to landscape on mobile when entering fullscreen
            try {
                (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.("landscape");
            } catch { /* desktop or unsupported — ignore */ }
        } else {
            document.exitFullscreen?.();
            try { screen.orientation.unlock?.(); } catch { /* ignore */ }
        }
    }

    useEffect(() => {
        const onFsChange = () => {
            const fs = !!document.fullscreenElement;
            setIsFullscreen(fs);
            if (!fs) { setFsChatOpen(false); setFsToolsOpen(false); }
        };
        document.addEventListener("fullscreenchange", onFsChange);
        return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    // ── Guess submit ──
    function submitGuess() {
        const text = guessInput.trim();
        if (!text || isDrawer) return;
        addChatMsg(myId ?? 0, myNameParam, text, false);
        wsSend({ type: "chat", text, playerId: myId, playerName: myNameParam });
        setGuessInput("");
        guessInputRef.current?.focus();
    }

    // ── Game over → round-summary page (final round only) ──
    function dismissRoundOver() {
        const data = roundOverData;
        setRoundOverData(null);
        const scoresStr = (data?.scores ?? players.map(p => ({ name: p.name, score: p.score })))
            .map(s => `${s.name}:${s.score}`)
            .join(",");
        const correctStr = (data?.correctGuessers ?? correctGuessers).join(",");
        const drawer = players.find(p => p.id === drawerId)?.name ?? drawerName;
        const word = data?.word ?? secretWord;
        const params = new URLSearchParams({
            word,
            round: String(currentRound),
            rounds: String(totalRounds),
            time: String(roundTime),
            name: myNameParam,
            drawer,
            scores: scoresStr,
            correct: correctStr,
            final: "1",
        });
        router.push(`/room/${roomId}/round-summary?${params.toString()}`);
    }

    const timerPct = (timeLeft / roundTime) * 100;
    const timerColor = timeLeft > 20 ? "#22c55e" : timeLeft > 10 ? "#f59e0b" : "#ef4444";

    const drawerName = players.find(p => p.id === drawerId)?.name ?? "?";
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes popIn {
                    0%   { opacity: 0; transform: scale(0.85); }
                    70%  { transform: scale(1.04); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(20px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.55; }
                }
                @keyframes timerPulse {
                    0%, 100% { transform: scale(1); }
                    50%       { transform: scale(1.06); }
                }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #f0f4ff; }
                .chat-msg { animation: slideInRight 0.2s ease-out; }
                .correct-msg { animation: popIn 0.35s ease-out; }
                .player-row { transition: background 0.25s, transform 0.2s; }
                .player-row:hover { transform: translateX(2px); }
                .tool-btn { transition: all 0.15s ease; }
                .tool-btn:hover { transform: translateY(-1px); }
                .color-swatch { transition: transform 0.15s ease; }
                .color-swatch:hover { transform: scale(1.18); }
                .guess-input:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important; }
                .send-btn:hover:not(:disabled) { background: #4f46e5 !important; transform: translateY(-1px); }
                .send-btn:active:not(:disabled) { transform: translateY(0); }
                .fullscreen-btn:hover { background: rgba(255,255,255,0.25) !important; }

                /* ── Chat scrollbar ── */
                .chat-scroll::-webkit-scrollbar { width: 6px; }
                .chat-scroll::-webkit-scrollbar-track { background: transparent; }
                .chat-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
                .chat-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                .chat-scroll { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }

                /* ── Fullscreen canvas card ── */
                :fullscreen { background: #0f172a; }
                .fs-canvas-card {
                    display: flex;
                    flex-direction: row;
                    border-radius: 0 !important;
                    border: none !important;
                    box-shadow: none !important;
                    background: #0f172a !important;
                    padding: 0 !important;
                    gap: 0 !important;
                    position: relative;
                }
                .fs-hud {
                    display: none;
                }
                .fs-canvas-card.is-fs .fs-hud {
                    display: flex;
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    z-index: 30;
                    background: rgba(0,0,0,0.55);
                    backdrop-filter: blur(8px);
                    padding: 6px 12px;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                /* canvas wrapper inside fullscreen takes remaining width */
                .fs-canvas-card.is-fs .fs-canvas-area {
                    flex: 1;
                    transition: flex 0.3s ease;
                }
                /* chat panel inside fullscreen */
                .fs-chat-panel {
                    width: 0;
                    overflow: hidden;
                    transition: width 0.3s ease;
                    background: white;
                    display: flex;
                    flex-direction: column;
                    flex-shrink: 0;
                }
                .fs-chat-panel.open {
                    width: 280px;
                }
                /* tools drawer inside fullscreen */
                .fs-tools-panel {
                    position: absolute;
                    bottom: 0; left: 0; right: 0;
                    z-index: 25;
                    transform: translateY(100%);
                    transition: transform 0.3s ease;
                    background: rgba(15,23,42,0.96);
                    backdrop-filter: blur(12px);
                    padding: 10px 14px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 8px;
                }
                .fs-tools-panel.open {
                    transform: translateY(0);
                }
                /* FABs */
                .fs-fabs {
                    display: none;
                    position: absolute;
                    top: 48px;
                    right: 8px;
                    flex-direction: column;
                    gap: 8px;
                    z-index: 35;
                }
                .fs-canvas-card.is-fs .fs-fabs { display: flex; }
                .fab-btn {
                    width: 42px;
                    height: 42px;
                    border-radius: 50%;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.35);
                    transition: transform 0.15s ease;
                    background: rgba(99,102,241,0.92);
                    color: white;
                }
                .fab-btn.active { background: #4f46e5; transform: scale(1.08); }
                .fab-btn:not(.active):hover { transform: scale(1.06); }
                .fab-btn.chat-fab { background: rgba(34,197,94,0.88); }
                .fab-btn.chat-fab.active { background: #16a34a; }
                /* normal fullscreen button hidden in fullscreen — FABs take over */
                .fs-canvas-card.is-fs .fullscreen-btn { display: none !important; }
                /* hide regular inline toolbar + word hint in fullscreen */
                .fs-canvas-card.is-fs .fs-inline-tools { display: none !important; }

                /* ── Mobile ── */
                @media (max-width: 768px) {
                    .game-layout   { flex-direction: column !important; }
                    .players-panel { width: 100% !important; flex-direction: row !important; flex-wrap: wrap !important; min-height: unset !important; order: 5 !important; }
                    .chat-panel    { width: 100% !important; min-height: 220px !important; order: 4 !important; }
                    .center-col    { order: 1 !important; }
                }
            `}</style>

            <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#f0f4ff 0%,#f8fafc 60%,#f0fdf4 100%)", display: "flex", flexDirection: "column", fontFamily: "var(--font-inter,Inter),sans-serif" }}>

                {/* ══════════════════ TOP BAR ══════════════════ */}
                <header style={{ background: "rgba(248,250,252,0.96)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e2e8f0", padding: "0.55rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", zIndex: 40, boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}>
                    <a href="/" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                        <span style={{ fontSize: "1.3rem" }}>🎨</span>
                        <span style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 900, fontSize: "1rem", background: "linear-gradient(135deg,#6366f1,#22c55e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>DrawTogether</span>
                    </a>

                    <span style={{ width: 1, height: 22, background: "#e2e8f0" }} />

                    <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#ede9fe", borderRadius: 8, padding: "3px 10px" }}>
                        <span style={{ fontSize: "0.68rem", color: "#7c3aed", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Room</span>
                        <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "#4f46e5", letterSpacing: 2 }}>{roomId}</span>
                    </div>

                    {/* Round indicator */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 9999, padding: "3px 12px" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#a5b4fc" }}>Round {currentRound} / {totalRounds}</span>
                    </div>

                    {/* WS dot */}
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: wsStatus === "connected" ? "#22c55e" : wsStatus === "connecting" ? "#f59e0b" : "#ef4444", display: "inline-block", animation: wsStatus === "connecting" ? "pulse 1s infinite" : "none" }} />
                        <span style={{ fontSize: "0.72rem", color: "#475569", fontWeight: 600 }}>{wsStatus === "connected" ? "Connected" : wsStatus === "connecting" ? "Connecting…" : "Disconnected"}</span>
                    </div>
                </header>

                {/* ══════════════════ TIMER BAR ══════════════════ */}
                <div style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", padding: "0.5rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                    {/* Timer */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: "1.25rem", animation: timeLeft <= 10 && roundPhase === "drawing" ? "timerPulse 0.8s ease-in-out infinite" : "none" }}>⏱</span>
                        <span style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 900, fontSize: "1.5rem", color: timerColor, minWidth: 48, transition: "color 0.5s", animation: timeLeft <= 10 && roundPhase === "drawing" ? "timerPulse 0.8s ease-in-out infinite" : "none" }}>
                            {roundPhase === "drawing" ? `${timeLeft}s` : "—"}
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 9999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${roundPhase === "drawing" ? timerPct : 0}%`, background: timerColor, borderRadius: 9999, transition: "width 0.9s linear, background 0.5s" }} />
                    </div>

                    {/* Round phase label */}
                    {roundPhase === "drawing" && (
                        <div style={{ flexShrink: 0, fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>
                            {isDrawer ? "✏️ You are drawing" : `✏️ ${drawerName} is drawing`}
                        </div>
                    )}
                    {roundPhase === "waiting" && (
                        <div style={{ flexShrink: 0, fontSize: "0.8rem", fontWeight: 700, color: "#64748b", animation: "pulse 2s infinite" }}>
                            ⏳ Waiting for round to start…
                        </div>
                    )}
                </div>

                {/* ══════════════════ MAIN LAYOUT ══════════════════ */}
                <div className="game-layout" style={{ flex: 1, display: "flex", gap: "0.6rem", padding: "0.6rem", minHeight: 0 }}>

                    {/* ── PLAYERS PANEL (LEFT) ── */}
                    <aside className="players-panel" style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "1rem", padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.4rem", height: "100%", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
                            <h3 style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 800, fontSize: "0.78rem", color: "#475569", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Players</h3>

                            {sortedPlayers.map((p, rank) => (
                                <div
                                    key={p.id}
                                    className="player-row"
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 7,
                                        padding: "0.55rem 0.7rem",
                                        borderRadius: "0.65rem",
                                        background: p.isDrawing
                                            ? "rgba(99,102,241,0.1)"
                                            : p.id === myId
                                                ? "rgba(34,197,94,0.08)"
                                                : "#f8fafc",
                                        border: p.isDrawing
                                            ? "1px solid rgba(99,102,241,0.4)"
                                            : p.id === myId
                                                ? "1px solid rgba(34,197,94,0.35)"
                                                : "1px solid #e8ecf0",
                                        animation: "fadeInUp 0.3s ease-out",
                                    }}
                                >
                                    {/* Rank / icon */}
                                    <span style={{ fontSize: "1rem", flexShrink: 0 }}>
                                        {p.isDrawing ? "✏️" : rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "🙂"}
                                    </span>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 700, fontSize: "0.82rem", color: p.isDrawing ? "#4f46e5" : p.id === myId ? "#059669" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {p.name}{p.id === myId && " (you)"}
                                        </div>
                                        <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>
                                            {p.isHost ? "Host · " : ""}{p.score} pts
                                        </div>
                                    </div>

                                    {/* Score badge */}
                                    <span style={{ flexShrink: 0, fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 800, fontSize: "0.8rem", color: rank === 0 ? "#d97706" : "#64748b" }}>
                                        {p.score}
                                    </span>
                                </div>
                            ))}

                            {players.length === 0 && (
                                <div style={{ color: "#94a3b8", fontSize: "0.78rem", textAlign: "center", paddingTop: 12, animation: "pulse 2s infinite" }}>
                                    Waiting for players…
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* ── CENTER COLUMN ── */}
                    <div className="center-col" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 0 }}>

                        {/* Canvas card — doubles as fullscreen root */}
                        <div
                            ref={canvasCardRef}
                            className={`fs-canvas-card${isFullscreen ? " is-fs" : ""}`}
                            style={{ flex: isFullscreen ? 1 : undefined, background: "white", border: "1px solid #e2e8f0", borderRadius: "1rem", padding: "0.6rem", display: "flex", flexDirection: "column", gap: "0.5rem", boxShadow: "0 1px 8px rgba(0,0,0,0.04)", position: "relative" }}
                        >
                            {/* ── Fullscreen HUD (timer + word hint, only visible in FS) ── */}
                            <div className="fs-hud">
                                {/* Timer */}
                                <span style={{ fontSize: "1rem", animation: timeLeft <= 10 && roundPhase === "drawing" ? "timerPulse 0.8s ease-in-out infinite" : "none" }}>⏱</span>
                                <span style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 900, fontSize: "1.25rem", color: timerColor, minWidth: 42, transition: "color 0.5s" }}>
                                    {roundPhase === "drawing" ? `${timeLeft}s` : "—"}
                                </span>
                                {/* Progress bar */}
                                <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.15)", borderRadius: 9999, overflow: "hidden", margin: "0 4px" }}>
                                    <div style={{ height: "100%", width: `${roundPhase === "drawing" ? timerPct : 0}%`, background: timerColor, borderRadius: 9999, transition: "width 0.9s linear, background 0.5s" }} />
                                </div>
                                {/* Word hint */}
                                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                                    {roundPhase === "drawing" ? (
                                        wordHint.split(" ").filter(Boolean).map((ch, i) => (
                                            <span key={i} style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 900, fontSize: ch === "_" ? "1.1rem" : "1.25rem", color: ch === "_" ? "rgba(255,255,255,0.45)" : "white", minWidth: 16, textAlign: "center", borderBottom: ch === "_" ? "2px solid rgba(255,255,255,0.4)" : "none", letterSpacing: 1.5 }}>{ch}</span>
                                        ))
                                    ) : (
                                        <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>—</span>
                                    )}
                                </div>
                                {/* Round badge */}
                                <span style={{ marginLeft: 6, fontSize: "0.72rem", color: "rgba(255,255,255,0.65)", fontWeight: 700, whiteSpace: "nowrap" }}>R{currentRound}/{totalRounds}</span>
                                {/* FS exit */}
                                <button onClick={toggleFullscreen} title="Exit fullscreen" style={{ marginLeft: 4, width: 28, height: 28, borderRadius: "0.4rem", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 1H1v4M9 1h4v4M1 9v4h4M13 9v4H9"/></svg>
                                </button>
                            </div>

                            {/* ── FABs (Tools + Chat), only in fullscreen ── */}
                            <div className="fs-fabs">
                                {isDrawer && (
                                    <button
                                        className={`fab-btn${fsToolsOpen ? " active" : ""}`}
                                        title="Tools"
                                        onClick={() => setFsToolsOpen(p => !p)}
                                    >🖌️</button>
                                )}
                                <button
                                    className={`fab-btn chat-fab${fsChatOpen ? " active" : ""}`}
                                    title="Chat"
                                    onClick={() => setFsChatOpen(p => !p)}
                                >💬</button>
                            </div>

                            {/* ── Main area: canvas + sliding chat ── */}
                            <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

                                {/* Canvas wrapper */}
                                <div
                                    className="fs-canvas-area"
                                    style={{ flex: 1, position: "relative", borderRadius: isFullscreen ? 0 : "0.65rem", overflow: "hidden", background: "#ffffff", boxShadow: isFullscreen ? "none" : "0 0 0 1px #e2e8f0", paddingTop: isFullscreen ? "36px" : 0 }}
                                >
                                    <div style={{ position: "relative", width: "100%", paddingBottom: isFullscreen ? undefined : "56.25%", height: isFullscreen ? "100%" : undefined }}>
                                        <canvas
                                            ref={canvasRef}
                                            width={1280}
                                            height={720}
                                            style={{ position: isFullscreen ? "relative" : "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "block", background: "#ffffff", cursor: isDrawer ? (activeTool === "fill" ? "copy" : "crosshair") : "default", touchAction: "none" }}
                                            onMouseDown={startDraw}
                                            onMouseMove={draw}
                                            onMouseUp={(e) => { endDraw(e); handleCanvasClick(e); }}
                                            onMouseLeave={endDraw}
                                            onClick={handleCanvasClick}
                                        />
                                    </div>

                                    {/* Fullscreen entry button (normal mode only) */}
                                    <button
                                        className="fullscreen-btn"
                                        onClick={toggleFullscreen}
                                        title="Enter fullscreen"
                                        style={{ position: "absolute", top: 8, right: 8, width: 34, height: 34, borderRadius: "0.5rem", background: "rgba(255,255,255,0.92)", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem", boxShadow: "0 1px 6px rgba(0,0,0,0.1)", zIndex: 10, transition: "all 0.15s", color: "#475569" }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 1h4v4M1 5V1h4M1 9v4h4M9 13h4V9"/></svg>
                                    </button>

                                    {/* Waiting banner (non-blocking) */}
                                    {roundPhase === "waiting" && (
                                        <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", background: "rgba(99,102,241,0.9)", color: "white", borderRadius: "0.55rem", padding: "4px 14px", fontSize: "0.75rem", fontWeight: 700, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 5 }}>
                                            ⏳ Waiting for round to start…
                                        </div>
                                    )}
                                </div>

                                {/* ── Fullscreen inline chat panel (slides from right) ── */}
                                {isFullscreen && (
                                    <div className={`fs-chat-panel${fsChatOpen ? " open" : ""}`} style={{ borderLeft: fsChatOpen ? "1px solid #e2e8f0" : "none", padding: fsChatOpen ? "0.75rem" : 0 }}>
                                        {fsChatOpen && (
                                            <>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                                    <span style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 800, fontSize: "0.78rem", color: "#475569", textTransform: "uppercase", letterSpacing: 1.5 }}>Guesses</span>
                                                    <button onClick={() => setFsChatOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1rem", lineHeight: 1 }}>✕</button>
                                                </div>
                                                <div className="chat-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                                                    {chat.length === 0 && <div style={{ color: "#94a3b8", fontSize: "0.78rem", textAlign: "center", paddingTop: 12 }}>No guesses yet…</div>}
                                                    {chat.map(msg => (
                                                        <div key={msg.id} className={msg.isCorrect ? "correct-msg chat-msg" : "chat-msg"} style={{ padding: msg.isSystem ? "4px 8px" : "6px 10px", borderRadius: "0.6rem", background: msg.isCorrect ? "rgba(34,197,94,0.1)" : msg.isSystem ? "rgba(99,102,241,0.08)" : msg.playerId === myId ? "rgba(99,102,241,0.1)" : "#f8fafc", border: msg.isCorrect ? "1px solid rgba(34,197,94,0.3)" : msg.isSystem ? "1px solid rgba(99,102,241,0.18)" : "1px solid #f1f5f9" }}>
                                                            {msg.isSystem ? (
                                                                <span style={{ fontSize: "0.72rem", color: msg.isCorrect ? "#059669" : "#6366f1", fontWeight: 700 }}>{msg.text}</span>
                                                            ) : (
                                                                <>
                                                                    <span style={{ fontSize: "0.68rem", fontWeight: 700, color: msg.playerId === myId ? "#4f46e5" : "#475569" }}>{msg.playerName}: </span>
                                                                    <span style={{ fontSize: "0.75rem", color: msg.isCorrect ? "#059669" : "#0f172a", fontWeight: msg.isCorrect ? 700 : 400 }}>{msg.text}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <div ref={chatBottomRef} />
                                                </div>
                                                {!isDrawer && (
                                                    <form onSubmit={(e) => { e.preventDefault(); submitGuess(); }} style={{ display: "flex", gap: 5, marginTop: 4, flexShrink: 0 }}>
                                                        <input ref={guessInputRef} className="guess-input" type="text" placeholder="Your guess…" value={guessInput} onChange={e => setGuessInput(e.target.value)} disabled={roundPhase !== "drawing"} autoComplete="off" style={{ flex: 1, padding: "0.45rem 0.6rem", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "0.5rem", color: "#0f172a", fontSize: "0.78rem", opacity: roundPhase !== "drawing" ? 0.5 : 1 }} />
                                                        <button type="submit" className="send-btn" disabled={!guessInput.trim() || roundPhase !== "drawing"} style={{ padding: "0.45rem 0.7rem", background: "#6366f1", color: "white", border: "none", borderRadius: "0.5rem", fontWeight: 700, fontSize: "0.75rem", cursor: guessInput.trim() && roundPhase === "drawing" ? "pointer" : "not-allowed", opacity: guessInput.trim() && roundPhase === "drawing" ? 1 : 0.45 }}>→</button>
                                                    </form>
                                                )}
                                                {isDrawer && roundPhase === "drawing" && (
                                                    <div style={{ padding: "0.4rem 0.6rem", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "0.5rem", fontSize: "0.7rem", color: "#4f46e5", fontWeight: 600, textAlign: "center", marginTop: 4, flexShrink: 0 }}>✏️ You are drawing!</div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Fullscreen tools drawer (slides up from bottom) ── */}
                            {isFullscreen && isDrawer && (
                                <div className={`fs-tools-panel${fsToolsOpen ? " open" : ""}`}>
                                    <div style={{ display: "flex", gap: 4 }}>
                                        {(["pen", "spray", "fill", "eraser"] as ToolName[]).map(t => (
                                            <button key={t} className="tool-btn" title={t.charAt(0).toUpperCase() + t.slice(1)} onClick={() => setActiveTool(t)} style={{ width: 38, height: 38, borderRadius: "0.55rem", border: activeTool === t ? "2px solid #818cf8" : "1.5px solid rgba(255,255,255,0.15)", background: activeTool === t ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)", color: "white", fontSize: "1rem", cursor: "pointer" }}>
                                                {t === "pen" ? "✏️" : t === "spray" ? "🎨" : t === "fill" ? "🪣" : "🧹"}
                                            </button>
                                        ))}
                                    </div>
                                    <span style={{ width: 1, height: 28, background: "rgba(255,255,255,0.12)" }} />
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                        {COLORS.map(c => (
                                            <button key={c} className="color-swatch" onClick={() => { setColor(c); if (activeTool === "eraser") setActiveTool("pen"); }} style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: color === c ? "2.5px solid #818cf8" : "2px solid rgba(255,255,255,0.2)", cursor: "pointer", boxShadow: color === c ? "0 0 0 2px rgba(99,102,241,0.55)" : "none" }} />
                                        ))}
                                        <label title="Custom" style={{ width: 24, height: 24, borderRadius: "50%", background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)", border: "2px solid rgba(255,255,255,0.2)", cursor: "pointer", display: "inline-block", overflow: "hidden", position: "relative" }}>
                                            <input type="color" value={color} onChange={e => { setColor(e.target.value); if (activeTool === "eraser") setActiveTool("pen"); }} style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer" }} />
                                        </label>
                                    </div>
                                    <span style={{ width: 1, height: 28, background: "rgba(255,255,255,0.12)" }} />
                                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                        {BRUSH_SIZES.map(s => (
                                            <button key={s} className="tool-btn" onClick={() => setBrushSize(s)} title={`${s}px`} style={{ width: 32, height: 32, borderRadius: "0.45rem", border: brushSize === s ? "2px solid #818cf8" : "1.5px solid rgba(255,255,255,0.15)", background: brushSize === s ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.08)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <span style={{ width: Math.max(s * 0.5, 3), height: Math.max(s * 0.5, 3), borderRadius: "50%", background: brushSize === s ? "#a5b4fc" : "rgba(255,255,255,0.5)", display: "inline-block" }} />
                                            </button>
                                        ))}
                                    </div>
                                    <span style={{ width: 1, height: 28, background: "rgba(255,255,255,0.12)" }} />
                                    <button onClick={handleClearCanvas} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0.35rem 0.85rem", borderRadius: "0.55rem", border: "1.5px solid rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.2)", color: "#fca5a5", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>🗑️ Clear</button>
                                </div>
                            )}

                            {/* ── Drawing Tools (normal mode only) ── */}
                            {!isFullscreen && isDrawer && (
                                <div className="fs-inline-tools" style={{ background: "#f8fafc", borderRadius: "0.75rem", padding: "0.6rem 0.85rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.6rem", border: "1px solid #e2e8f0" }}>
                                    {/* Tools */}
                                    <div style={{ display: "flex", gap: 4 }}>
                                        {(["pen", "spray", "fill", "eraser"] as ToolName[]).map(t => (
                                            <button
                                                key={t}
                                                className="tool-btn"
                                                title={t.charAt(0).toUpperCase() + t.slice(1)}
                                                onClick={() => setActiveTool(t)}
                                                style={{ width: 36, height: 36, borderRadius: "0.55rem", border: activeTool === t ? "2px solid #6366f1" : "1.5px solid #e2e8f0", background: activeTool === t ? "rgba(99,102,241,0.15)" : "white", color: "#334155", fontSize: "1rem", cursor: "pointer" }}
                                            >
                                                {t === "pen" ? "✏️" : t === "spray" ? "🎨" : t === "fill" ? "🪣" : "🧹"}
                                            </button>
                                        ))}
                                    </div>
                                    <span style={{ width: 1, height: 28, background: "#e2e8f0" }} />
                                    {/* Colors */}
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                        {COLORS.map(c => (
                                            <button key={c} className="color-swatch" onClick={() => { setColor(c); if (activeTool === "eraser") setActiveTool("pen"); }} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: color === c ? "2.5px solid #6366f1" : "2px solid rgba(0,0,0,0.12)", cursor: "pointer", boxShadow: color === c ? `0 0 0 2px rgba(99,102,241,0.4)` : "none" }} />
                                        ))}
                                        <label title="Custom color" style={{ width: 22, height: 22, borderRadius: "50%", background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)", border: "2px solid rgba(0,0,0,0.12)", cursor: "pointer", display: "inline-block", overflow: "hidden", position: "relative" }}>
                                            <input type="color" value={color} onChange={e => { setColor(e.target.value); if (activeTool === "eraser") setActiveTool("pen"); }} style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer" }} />
                                        </label>
                                    </div>
                                    <span style={{ width: 1, height: 28, background: "#e2e8f0" }} />
                                    {/* Brush sizes */}
                                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                        {BRUSH_SIZES.map(s => (
                                            <button key={s} className="tool-btn" onClick={() => setBrushSize(s)} title={`${s}px`} style={{ width: 30, height: 30, borderRadius: "0.45rem", border: brushSize === s ? "2px solid #6366f1" : "1.5px solid #e2e8f0", background: brushSize === s ? "rgba(99,102,241,0.12)" : "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <span style={{ width: Math.max(s * 0.5, 3), height: Math.max(s * 0.5, 3), borderRadius: "50%", background: brushSize === s ? "#6366f1" : "#94a3b8", display: "inline-block" }} />
                                            </button>
                                        ))}
                                    </div>
                                    <span style={{ width: 1, height: 28, background: "#e2e8f0" }} />
                                    <button onClick={handleClearCanvas} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0.35rem 0.8rem", borderRadius: "0.55rem", border: "1.5px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.07)", color: "#dc2626", fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", transition: "all 0.15s" }}>🗑️ Clear</button>
                                </div>
                            )}
                        </div>

                        {/* ── WORD HINT ── */}
                        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "0.85rem", padding: "0.7rem 1.1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5 }}>Word</span>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                                {roundPhase === "drawing" ? (
                                    wordHint.split(" ").filter(Boolean).map((ch, i) => (
                                        <span
                                            key={i}
                                            style={{
                                                fontFamily: "var(--font-nunito,Nunito),sans-serif",
                                                fontWeight: 900,
                                                fontSize: ch === "_" ? "1.6rem" : "1.8rem",
                                                color: ch === "_" ? "#94a3b8" : "#0f172a",
                                                minWidth: 24,
                                                textAlign: "center",
                                                borderBottom: ch === "_" ? "2.5px solid #94a3b8" : "none",
                                                letterSpacing: 2,
                                                transition: "color 0.3s",
                                            }}
                                        >
                                            {ch}
                                        </span>
                                    ))
                                ) : (
                                    <span style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 700, fontSize: "1rem", color: "#64748b" }}>
                                        {roundPhase === "waiting" ? "Round hasn't started yet" : "—"}
                                    </span>
                                )}
                            </div>
                            {isDrawer && roundPhase === "drawing" && (
                                <span style={{ fontSize: "0.72rem", color: "#6366f1", fontWeight: 600, background: "rgba(99,102,241,0.12)", padding: "2px 8px", borderRadius: 9999 }}>You're drawing this!</span>
                            )}
                        </div>
                    </div>

                    {/* ── CHAT PANEL (RIGHT) ── */}
                    <aside className="chat-panel" style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <div style={{ flex: 1, background: "white", border: "1px solid #e2e8f0", borderRadius: "1rem", padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.5rem", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
                            <h3 style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 800, fontSize: "0.78rem", color: "#475569", textTransform: "uppercase", letterSpacing: 1.5 }}>Guesses</h3>

                            {/* Messages */}
                            <div className="chat-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.3rem", overflowX: "hidden" }}>
                                {chat.length === 0 && (
                                    <div style={{ color: "#94a3b8", fontSize: "0.78rem", textAlign: "center", paddingTop: 16 }}>No guesses yet…</div>
                                )}
                                {chat.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={msg.isCorrect ? "correct-msg chat-msg" : "chat-msg"}
                                        style={{
                                            padding: msg.isSystem ? "4px 8px" : "6px 10px",
                                            borderRadius: "0.6rem",
                                            background: msg.isCorrect
                                                ? "rgba(34,197,94,0.1)"
                                                : msg.isSystem
                                                    ? "rgba(99,102,241,0.08)"
                                                    : msg.playerId === myId
                                                        ? "rgba(99,102,241,0.1)"
                                                        : "#f8fafc",
                                            border: msg.isCorrect
                                                ? "1px solid rgba(34,197,94,0.3)"
                                                : msg.isSystem
                                                    ? "1px solid rgba(99,102,241,0.18)"
                                                    : "1px solid #f1f5f9",
                                        }}
                                    >
                                        {msg.isSystem ? (
                                            <span style={{ fontSize: "0.75rem", color: msg.isCorrect ? "#059669" : "#6366f1", fontWeight: 700 }}>{msg.text}</span>
                                        ) : (
                                            <>
                                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: msg.playerId === myId ? "#4f46e5" : "#475569" }}>{msg.playerName}: </span>
                                                <span style={{ fontSize: "0.78rem", color: msg.isCorrect ? "#059669" : "#0f172a", fontWeight: msg.isCorrect ? 700 : 400 }}>{msg.text}</span>
                                            </>
                                        )}
                                    </div>
                                ))}
                                <div ref={chatBottomRef} />
                            </div>

                            {/* Guess input */}
                            {!isDrawer && (
                                <form
                                    onSubmit={(e) => { e.preventDefault(); submitGuess(); }}
                                    style={{ display: "flex", gap: 6 }}
                                >
                                    <input
                                        ref={guessInputRef}
                                        className="guess-input"
                                        type="text"
                                        placeholder="Type your guess…"
                                        value={guessInput}
                                        onChange={e => setGuessInput(e.target.value)}
                                        disabled={roundPhase !== "drawing"}
                                        autoComplete="off"
                                        style={{
                                            flex: 1,
                                            padding: "0.5rem 0.7rem",
                                            background: "#f8fafc",
                                            border: "1.5px solid #e2e8f0",
                                            borderRadius: "0.55rem",
                                            color: "#0f172a",
                                            fontSize: "0.82rem",
                                            fontFamily: "var(--font-nunito,Nunito),sans-serif",
                                            transition: "border-color 0.2s, box-shadow 0.2s",
                                            opacity: roundPhase !== "drawing" ? 0.5 : 1,
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        className="send-btn"
                                        disabled={!guessInput.trim() || roundPhase !== "drawing"}
                                        style={{ padding: "0.5rem 0.85rem", background: "#6366f1", color: "white", border: "none", borderRadius: "0.55rem", fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: guessInput.trim() && roundPhase === "drawing" ? "pointer" : "not-allowed", opacity: guessInput.trim() && roundPhase === "drawing" ? 1 : 0.45, transition: "all 0.15s" }}
                                    >
                                        Guess
                                    </button>
                                </form>
                            )}

                            {isDrawer && roundPhase === "drawing" && (
                                <div style={{ padding: "0.5rem 0.7rem", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "0.55rem", fontSize: "0.75rem", color: "#4f46e5", fontWeight: 600, textAlign: "center" }}>
                                    ✏️ You are drawing — no guessing!
                                </div>
                            )}
                        </div>
                    </aside>
                </div>

                {/* ══════════════════ GAME OVER OVERLAY (final round only) ══════════════════ */}
                {roundOverData && (
                    <div
                        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1.5rem" }}
                        onClick={dismissRoundOver}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "1.5rem", padding: "2rem 2.25rem", maxWidth: 460, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.18)", animation: "popIn 0.4s ease-out" }}
                        >
                            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                                <div style={{ fontSize: "2.8rem", marginBottom: 8 }}>🏆</div>
                                <h2 style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 900, fontSize: "1.55rem", color: "#0f172a", margin: 0 }}>Game Over!</h2>
                                <p style={{ marginTop: 6, color: "#64748b", fontSize: "0.9rem" }}>
                                    Final word was: <strong style={{ color: "#f59e0b", fontSize: "1.1rem", letterSpacing: 1.5 }}>{roundOverData.word.toUpperCase()}</strong>
                                </p>
                            </div>

                            {/* Final Scores */}
                            <div style={{ marginBottom: "1.5rem" }}>
                                <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Final Scores</p>
                                {roundOverData.scores.sort((a, b) => b.score - a.score).map((s, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                                        <span style={{ fontSize: "1rem" }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  "}</span>
                                        <span style={{ flex: 1, fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "#334155" }}>{s.name}</span>
                                        <span style={{ fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 900, fontSize: "1rem", color: i === 0 ? "#d97706" : "#64748b" }}>{s.score} pts</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={dismissRoundOver}
                                style={{ width: "100%", padding: "0.85rem", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "white", border: "none", borderRadius: 9999, fontFamily: "var(--font-nunito,Nunito),sans-serif", fontWeight: 900, fontSize: "1rem", cursor: "pointer", boxShadow: "0 6px 20px rgba(99,102,241,0.4)", transition: "all 0.2s" }}
                            >
                                🏆 See Final Results
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
