"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ToolName =
    | "pen"
    | "neon"
    | "rainbow"
    | "spray"
    | "mirror"
    | "glitter"
    | "fill"
    | "star"
    | "heart"
    | "circle"
    | "eraser";

type DrawEvent = {
    type: "draw" | "end" | "clear" | "fill" | "stamp"
        | "connected" | "player_joined" | "player_left" | "error";
    x?: number;
    y?: number;
    color?: string;
    size?: number;
    fromX?: number;
    fromY?: number;
    tool?: ToolName;
    hue?: number;       // for rainbow
    player?: number;    // server: which player number you are
    players?: number;   // server: current player count in room
    message?: string;   // server: error message
};

type PlayerStatus = "waiting" | "connected";

// ── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
    { name: "Black", value: "#0f172a" },
    { name: "White", value: "#ffffff" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Red", value: "#ef4444" },
    { name: "Green", value: "#22c55e" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Pink", value: "#ec4899" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Orange", value: "#f97316" },
];

const BRUSH_SIZES = [
    { label: "XS", value: 2 },
    { label: "S", value: 4 },
    { label: "M", value: 8 },
    { label: "L", value: 16 },
    { label: "XL", value: 28 },
];

// ── Tool catalogue ─────────────────────────────────────────────────────────

interface ToolDef {
    id: ToolName;
    icon: string;
    label: string;
    desc: string;
    group: "brush" | "shape" | "utility";
    dark?: boolean; // needs dark bg in toolbar
}

const TOOLS: ToolDef[] = [
    { id: "pen", icon: "✏️", label: "Pen", desc: "Smooth freehand pen", group: "brush" },
    { id: "neon", icon: "⚡", label: "Neon", desc: "5-layer neon glow · white core", group: "brush", dark: true },
    { id: "rainbow", icon: "🌈", label: "Rainbow", desc: "Hue-shifts as you draw", group: "brush" },
    { id: "spray", icon: "🎨", label: "Spray", desc: "Airbrush — random dot cloud", group: "brush" },
    { id: "mirror", icon: "🪞", label: "Mirror", desc: "Draws symmetrically on both sides", group: "brush" },
    { id: "glitter", icon: "✨", label: "Glitter", desc: "Sparkle burst around your cursor", group: "brush" },
    { id: "fill", icon: "🪣", label: "Fill", desc: "Flood-fill an enclosed area", group: "utility" },
    { id: "eraser", icon: "🧹", label: "Eraser", desc: "Erase to white", group: "utility" },
    { id: "star", icon: "⭐", label: "Star", desc: "Stamp a 5-point star", group: "shape" },
    { id: "heart", icon: "❤️", label: "Heart", desc: "Stamp a heart", group: "shape" },
    { id: "circle", icon: "⬤", label: "Circle", desc: "Stamp a filled circle", group: "shape" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCanvasCoords(
    e: React.MouseEvent | React.TouchEvent,
    canvas: HTMLCanvasElement
): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function hexToRgb(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// ── Canvas Drawing Library ────────────────────────────────────────────────────

/** Standard smooth pen stroke */
function applyLine(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number, toX: number, toY: number,
    color: string, size: number
) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
}

/**
 * 5-pass neon glow:
 *  1. Massive diffuse aura  (pure color, very wide, very transparent)
 *  2. Wide  outer halo      (color, wide, low alpha)
 *  3. Mid   glow            (color, medium, medium alpha + shadow)
 *  4. Inner bright edge     (lighter color blend, narrow, high alpha)
 *  5. Blazing white core    (white, very thin, fully opaque)
 */
function applyNeon(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number, toX: number, toY: number,
    color: string, size: number
) {
    const rgb = hexToRgb(color);
    const colorStr = `rgb(${rgb.r},${rgb.g},${rgb.b})`;

    const passes: [number, number, number, string][] = [
        [size * 12, 0.06, size * 20, colorStr],   // 1 – massive aura
        [size * 7, 0.15, size * 12, colorStr],   // 2 – outer halo
        [size * 3, 0.55, size * 6, colorStr],   // 3 – mid glow
        [size * 1.5, 0.85, size * 3, `rgba(${Math.min(rgb.r + 80, 255)},${Math.min(rgb.g + 80, 255)},${Math.min(rgb.b + 80, 255)},1)`], // 4 – bright edge
        [size * 0.5, 1.0, size * 1, "#ffffff"],  // 5 – white-hot core
    ];

    passes.forEach(([lineWidth, alpha, shadowBlur, strokeStyle]) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = colorStr;
        ctx.shadowBlur = shadowBlur;
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.restore();
    });
}

/** Rainbow hue-shifting brush */
function applyRainbow(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number, toX: number, toY: number,
    hue: number, size: number
) {
    const c = hslToHex(hue % 360, 100, 55);
    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = size * 1.5;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = c;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
}

/** Spray / airbrush — random particle cloud */
function applySpray(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    color: string, size: number
) {
    const radius = size * 4;
    const density = Math.max(30, size * 5);
    const rgb = hexToRgb(color);
    ctx.save();
    for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius;
        const px = x + dist * Math.cos(angle);
        const py = y + dist * Math.sin(angle);
        const alpha = (1 - dist / radius) * 0.4 + 0.05;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
        ctx.beginPath();
        ctx.arc(px, py, Math.random() * (size / 3) + 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/** BFS flood fill */
function applyFloodFill(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    startX: number, startY: number,
    fillColor: string
) {
    const sx = Math.round(startX);
    const sy = Math.round(startY);
    const w = canvas.width;
    const h = canvas.height;

    // Use willReadFrequently context for pixel-level ops
    const rfCtx = canvas.getContext("2d", { willReadFrequently: true })!;
    const imageData = rfCtx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const idx = (x: number, y: number) => (y * w + x) * 4;
    const start = idx(sx, sy);
    const targetR = data[start], targetG = data[start + 1], targetB = data[start + 2], targetA = data[start + 3];

    const fill = hexToRgb(fillColor);
    if (fill.r === targetR && fill.g === targetG && fill.b === targetB && targetA === 255) return;

    function matchTarget(i: number) {
        return (
            Math.abs(data[i] - targetR) < 32 &&
            Math.abs(data[i + 1] - targetG) < 32 &&
            Math.abs(data[i + 2] - targetB) < 32 &&
            Math.abs(data[i + 3] - targetA) < 32
        );
    }

    const stack: number[][] = [[sx, sy]];
    const visited = new Uint8Array(w * h);
    visited[sy * w + sx] = 1;

    while (stack.length) {
        const [cx, cy] = stack.pop()!;
        const ci = idx(cx, cy);
        data[ci] = fill.r;
        data[ci + 1] = fill.g;
        data[ci + 2] = fill.b;
        data[ci + 3] = 255;

        const neighbors = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
        for (const [nx, ny] of neighbors) {
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const ni = ny * w + nx;
            if (visited[ni]) continue;
            visited[ni] = 1;
            if (matchTarget(idx(nx, ny))) stack.push([nx, ny]);
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

/** Draw a 5-point star stamp */
function applyStarStamp(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    color: string, size: number
) {
    const r1 = size * 2;
    const r2 = r1 * 0.45;
    const pts = 5;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
        const r = i % 2 === 0 ? r1 : r2;
        const ang = (Math.PI / pts) * i - Math.PI / 2;
        i === 0 ? ctx.moveTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang))
            : ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

/** Draw a heart stamp */
function applyHeartStamp(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    color: string, size: number
) {
    const s = size * 2.5;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.35);
    ctx.bezierCurveTo(cx, cy, cx - s, cy, cx - s, cy - s * 0.35);
    ctx.bezierCurveTo(cx - s, cy - s * 0.8, cx, cy - s * 0.8, cx, cy - s * 0.45);
    ctx.bezierCurveTo(cx, cy - s * 0.8, cx + s, cy - s * 0.8, cx + s, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s, cy, cx, cy, cx, cy + s * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

/** Draw a filled circle stamp */
function applyCircleStamp(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    color: string, size: number
) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/**
 * Mirror brush — draws the stroke AND its horizontal mirror image
 * across the canvas vertical centre line simultaneously.
 * The axis guide is shown as a CSS overlay, not painted on the canvas.
 */
function applyMirror(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    fromX: number, fromY: number,
    toX: number, toY: number,
    color: string, size: number
) {
    const w = canvas.width;
    // Primary stroke
    applyLine(ctx, fromX, fromY, toX, toY, color, size);
    // Mirrored stroke (flip X around centre)
    applyLine(ctx, w - fromX, fromY, w - toX, toY, color, size);
    // NOTE: no guide line drawn here — axis is shown via a CSS overlay div
}

/**
 * Glitter brush — scatters tiny 4-point sparkle stars around the cursor.
 * Each sparkle is randomly rotated, sized, and coloured with slight hue drift.
 */
function applyGlitter(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    color: string, size: number
) {
    const rgb = hexToRgb(color);
    const count = Math.max(8, size * 3);
    const spread = size * 5;

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * spread;
        const px = x + dist * Math.cos(angle);
        const py = y + dist * Math.sin(angle);
        const r = Math.max(1, (1 - dist / spread) * size * 0.7 + Math.random() * 2);
        const rot = Math.random() * Math.PI;
        const hDrift = Math.round((Math.random() - 0.5) * 60); // ±60 hue drift
        const dr = Math.min(255, rgb.r + hDrift);
        const dg = Math.min(255, rgb.g + hDrift);
        const db = Math.min(255, rgb.b + hDrift);
        const alpha = 0.5 + Math.random() * 0.5;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${dr},${dg},${db})`;
        ctx.shadowColor = `rgb(${dr},${dg},${db})`;
        ctx.shadowBlur = r * 3;
        ctx.translate(px, py);
        ctx.rotate(rot);
        // Draw a 4-arm sparkle star
        ctx.beginPath();
        for (let arm = 0; arm < 4; arm++) {
            const a = (Math.PI / 2) * arm;
            ctx.moveTo(0, 0);
            ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
        }
        ctx.lineWidth = r * 0.5;
        ctx.strokeStyle = `rgb(${dr},${dg},${db})`;
        ctx.lineCap = "round";
        ctx.stroke();
        // Bright centre dot
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.restore();
    }
}

// ── WebSocket hook ────────────────────────────────────────────────────────────

type WsStatus = "connecting" | "connected" | "disconnected" | "full";

function useWebSocket(roomId: string, onMessage: (data: DrawEvent) => void) {
    const wsRef = useRef<WebSocket | null>(null);
    const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");

    useEffect(() => {
        const backendUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
        const ws = new WebSocket(`${backendUrl}/ws/${roomId}`);
        wsRef.current = ws;
        setWsStatus("connecting");
        ws.onopen = () => setWsStatus("connected");
        ws.onclose = (e) => {
            // Code 4000 means the room is already full
            setWsStatus(e.code === 4000 ? "full" : "disconnected");
        };
        ws.onerror = () => setWsStatus("disconnected");
        ws.onmessage = (event) => {
            try { onMessage(JSON.parse(event.data)); } catch { /* ignore */ }
        };
        return () => ws.close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId]);

    const send = useCallback((data: DrawEvent) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    return { wsStatus, send };
}

// ── UI Sub-components ─────────────────────────────────────────────────────────

function WsStatusDot({ status }: { status: "connecting" | "connected" | "disconnected" }) {
    const map = {
        connected: { color: "#22c55e", label: "Connected" },
        connecting: { color: "#f59e0b", label: "Connecting…" },
        disconnected: { color: "#ef4444", label: "Disconnected" },
    };
    const { color, label } = map[status];
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", boxShadow: `0 0 0 2px ${color}33`, animation: status === "connected" ? "pulseWs 2s ease-in-out infinite" : "none" }} />
            {label}
        </span>
    );
}

function PlayerBadge({ label, status, color }: { label: string; status: PlayerStatus; color: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 9999, background: status === "connected" ? `${color}18` : "#f1f5f9", border: `1.5px solid ${status === "connected" ? color : "#e2e8f0"}`, fontSize: "0.78rem", fontWeight: 700, color: status === "connected" ? color : "#94a3b8", transition: "all 0.3s ease" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: status === "connected" ? color : "#cbd5e1", display: "inline-block", animation: status === "connected" ? "pulseWs 2s ease-in-out infinite" : "none" }} />
            {label}: {status === "connected" ? "Connected" : "Waiting…"}
        </div>
    );
}

function ToolBtn({
    tool, activeTool, onSelect, isNeonActive, neonColor,
}: {
    tool: ToolDef;
    activeTool: ToolName;
    onSelect: (id: ToolName) => void;
    isNeonActive: boolean;
    neonColor: string;
}) {
    const active = activeTool === tool.id;
    const isThisNeon = tool.id === "neon" && active && isNeonActive;

    return (
        <button
            title={tool.desc}
            onClick={() => onSelect(tool.id)}
            className={isThisNeon ? "neon-btn-active" : ""}
            style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                padding: "0.5rem 0.7rem",
                borderRadius: "0.75rem",
                border: active
                    ? tool.id === "neon" ? `2px solid ${neonColor}` : "2px solid #6366f1"
                    : "1.5px solid #e2e8f0",
                background: active
                    ? tool.id === "neon" ? "linear-gradient(135deg,#080818,#0f0f2e)" : "#ede9fe"
                    : "white",
                color: active
                    ? tool.id === "neon" ? neonColor : "#4f46e5"
                    : "#64748b",
                fontFamily: "var(--font-nunito), Nunito, sans-serif",
                fontWeight: 700,
                fontSize: "0.7rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: active && tool.id !== "neon" ? "0 0 0 3px #c7d2fe" : "0 1px 3px rgba(0,0,0,0.07)",
                whiteSpace: "nowrap",
                minWidth: 52,
                "--neon-c": neonColor,
            } as React.CSSProperties}
        >
            <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{tool.icon}</span>
            <span>{tool.label}</span>
        </button>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RoomPage() {
    const params = useParams<{ roomId: string }>();
    const roomId = params?.roomId ?? "unknown";

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const hueRef = useRef(0);   // for rainbow brush

    // ── History (undo / redo)
    const historyRef = useRef<ImageData[]>([]);
    const historyIndexRef = useRef(-1);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);   // hides hint overlay once user starts
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showFsToolbar, setShowFsToolbar] = useState(true); // toggle fs toolbar

    // ── Tool state
    const [activeTool, setActiveTool] = useState<ToolName>("pen");
    const [color, setColor] = useState("#0f172a");
    const [brushSize, setBrushSize] = useState(4);
    const [copied, setCopied] = useState(false);

    // ── Player state
    const [player2Status, setPlayer2Status] = useState<PlayerStatus>("waiting");
    const [activityMsg, setActivityMsg] = useState("Waiting for second player to join…");

    // ── Derived
    const isEraser = activeTool === "eraser";
    const isNeon = activeTool === "neon";
    const activeColor = isEraser ? "#ffffff" : color;
    const activeSize = isEraser ? Math.max(brushSize * 3, 20) : brushSize;

    // ── Canvas helpers ──────────────────────────────────────────────────────────

    function fillWhite(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Save current canvas pixels into the history stack (max 50 steps)
    function saveHistory() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // Truncate any redo future
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        historyRef.current.push(snap);
        if (historyRef.current.length > 50) historyRef.current.shift();
        historyIndexRef.current = historyRef.current.length - 1;
        setCanUndo(historyIndexRef.current > 0);
        setCanRedo(false);
    }

    function undo() {
        if (historyIndexRef.current <= 0) return;
        historyIndexRef.current -= 1;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0);
        setCanUndo(historyIndexRef.current > 0);
        setCanRedo(true);
    }

    function redo() {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current += 1;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0);
        setCanUndo(true);
        setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        fillWhite(ctx, canvas);
        // Save blank canvas as step 0 so undo always has a base
        const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
        historyRef.current = [snap];
        historyIndexRef.current = 0;
    }, []);

    // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Remote event handler ────────────────────────────────────────────────────

    const handleRemoteEvent = useCallback((data: DrawEvent) => {
        // ── Server control events (no canvas access needed) ──
        if (data.type === "player_joined") {
            setPlayer2Status("connected");
            setActivityMsg("Both players connected · Draw away! 🎨");
            return;
        }
        if (data.type === "player_left") {
            setPlayer2Status("waiting");
            setActivityMsg("Your friend left. Waiting for someone to join…");
            return;
        }
        if (data.type === "connected" || data.type === "error" || data.type === "end") {
            return;
        }

        // ── Canvas drawing events ──
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (data.type === "draw" && data.fromX !== undefined) {
            const tool = data.tool ?? "pen";
            if (tool === "neon") applyNeon(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "rainbow") applyRainbow(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.hue ?? 0, data.size!);
            else if (tool === "spray") applySpray(ctx, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "glitter") applyGlitter(ctx, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "mirror") applyMirror(ctx, canvas, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else applyLine(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            setActivityMsg("Friend is drawing…");
            setTimeout(() => setActivityMsg("Both players connected · Draw away!"), 2000);
        }

        if (data.type === "fill") {
            applyFloodFill(ctx, canvas, data.x!, data.y!, data.color!);
        }

        if (data.type === "stamp") {
            const s = data.size!;
            if (data.tool === "star") applyStarStamp(ctx, data.x!, data.y!, data.color!, s);
            if (data.tool === "heart") applyHeartStamp(ctx, data.x!, data.y!, data.color!, s);
            if (data.tool === "circle") applyCircleStamp(ctx, data.x!, data.y!, data.color!, s);
        }

        if (data.type === "clear") {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            fillWhite(ctx, canvas);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const router = useRouter();
    const { wsStatus, send } = useWebSocket(roomId, handleRemoteEvent);

    useEffect(() => {
        if (wsStatus === "full") {
            // Room already has 2 players — redirect to the room-full page
            router.replace("/room-full");
        } else if (wsStatus === "disconnected") {
            setPlayer2Status("waiting");
            setActivityMsg("Connection lost. Reconnecting…");
        }
        // player2Status is now driven by player_joined / player_left events from the server
    }, [wsStatus, router]);

    // ── Drawing event handlers ──────────────────────────────────────────────────

    function startDraw(e: React.MouseEvent | React.TouchEvent) {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Snapshot before each stroke for undo
        saveHistory();
        // Hide the hint overlay the moment the user picks up a brush
        if (!hasDrawn) setHasDrawn(true);
        isDrawingRef.current = true;
        lastPosRef.current = getCanvasCoords(e, canvas);
    }

    function draw(e: React.MouseEvent | React.TouchEvent) {
        e.preventDefault();
        if (!isDrawingRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const pos = getCanvasCoords(e, canvas);
        const from = lastPosRef.current ?? pos;

        // Stamp tools: handle on click, not drag
        if (activeTool === "star" || activeTool === "heart" || activeTool === "circle") {
            lastPosRef.current = pos;
            return;
        }

        if (activeTool === "neon") {
            applyNeon(ctx, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "neon" });
        } else if (activeTool === "rainbow") {
            hueRef.current = (hueRef.current + 2.5) % 360;
            applyRainbow(ctx, from.x, from.y, pos.x, pos.y, hueRef.current, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, size: activeSize, tool: "rainbow", hue: hueRef.current });
        } else if (activeTool === "spray") {
            applySpray(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "spray" });
        } else if (activeTool === "glitter") {
            applyGlitter(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "glitter" });
        } else if (activeTool === "mirror") {
            applyMirror(ctx, canvas, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "mirror" });
        } else {
            // pen or eraser
            applyLine(ctx, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: activeTool });
        }

        lastPosRef.current = pos;
    }

    function endDraw(e: React.MouseEvent | React.TouchEvent) {
        e.preventDefault();
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        lastPosRef.current = null;
        send({ type: "end" });
    }

    function handleCanvasClick(e: React.MouseEvent) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const pos = getCanvasCoords(e, canvas);

        if (activeTool === "fill") {
            applyFloodFill(ctx, canvas, pos.x, pos.y, activeColor);
            send({ type: "fill", x: pos.x, y: pos.y, color: activeColor });
        } else if (activeTool === "star") {
            applyStarStamp(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "stamp", x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "star" });
        } else if (activeTool === "heart") {
            applyHeartStamp(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "stamp", x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "heart" });
        } else if (activeTool === "circle") {
            applyCircleStamp(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "stamp", x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "circle" });
        }
    }

    // ── Actions ─────────────────────────────────────────────────────────────────

    function clearCanvas() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        saveHistory();
        fillWhite(ctx, canvas);
        send({ type: "clear" });
    }

    function downloadCanvas() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement("a");
        link.download = `drawtogether-${roomId}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }

    function copyLink() {
        navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    }

    function selectTool(id: ToolName) {
        setActiveTool(id);
        if (id !== "eraser" && id !== "fill" && id !== "star" && id !== "heart" && id !== "circle") {
            hueRef.current = 0;
        }
    }

    // ── Fullscreen + orientation lock ─────────────────────────────────────────────

    function toggleFullscreen() {
        const wrapper = canvasWrapperRef.current;
        if (!wrapper) return;
        if (!document.fullscreenElement) {
            wrapper.requestFullscreen().then(() => {
                setIsFullscreen(true);
                // Lock to landscape on mobile — silently ignores on desktop
                try {
                    screen.orientation?.lock?.("landscape").catch(() => { });
                } catch { /* not supported */ }
            }).catch(() => { });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
                try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
            }).catch(() => { });
        }
    }

    // Sync state if user presses Escape to exit fullscreen
    useEffect(() => {
        function onFsChange() {
            const fs = !!document.fullscreenElement;
            setIsFullscreen(fs);
            if (!fs) { try { screen.orientation?.unlock?.(); } catch { /* ignore */ } }
        }
        document.addEventListener("fullscreenchange", onFsChange);
        return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    const roomIdDisplay = roomId.toUpperCase().slice(0, 6);

    // ── Cursor ──────────────────────────────────────────────────────────────────

    const cursorMap: Record<ToolName, string> = {
        pen: "crosshair", neon: "crosshair", rainbow: "crosshair", spray: "cell",
        mirror: "crosshair", glitter: "cell",
        fill: "copy", eraser: "cell", star: "copy", heart: "copy", circle: "copy",
    };

    // ── Brush preview color ──────────────────────────────────────────────────────

    const previewColor = isEraser ? "#e2e8f0" : activeTool === "rainbow"
        ? hslToHex(hueRef.current, 100, 55) : activeColor;

    const previewGlow = activeTool === "neon"
        ? `0 0 8px 3px ${color}, 0 0 24px 6px ${color}`
        : activeTool === "rainbow"
            ? `0 0 6px 2px ${previewColor}, 0 0 16px 4px ${previewColor}`
            : isEraser ? "none" : `0 0 0 3px ${color}33`;

    // ── Render ───────────────────────────────────────────────────────────────────

    return (
        <>
            <style>{`
        @keyframes pulseWs {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.45); }
          50%       { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes neonPulse {
          0%, 100% { box-shadow: 0 0 6px 2px var(--neon-c,#a78bfa), 0 0 20px 5px var(--neon-c,#a78bfa); }
          50%       { box-shadow: 0 0 18px 8px var(--neon-c,#a78bfa), 0 0 48px 14px var(--neon-c,#a78bfa); }
        }
        @keyframes rainbowSpin {
          from { filter: hue-rotate(0deg); }
          to   { filter: hue-rotate(360deg); }
        }
        @keyframes hintFadeOut {
          from { opacity: 0.3; }
          to   { opacity: 0; pointer-events: none; }
        }
        @keyframes fsToolbarIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .neon-btn-active  { animation: neonPulse 1.6s ease-in-out infinite; }
        .preview-neon     { animation: neonPulse 1.6s ease-in-out infinite; }
        .preview-rainbow  { animation: rainbowSpin 2s linear infinite; }
        .canvas-hint-visible { opacity: 0.3; transition: opacity 0.6s ease; pointer-events: none; }
        .canvas-hint-hidden  { opacity: 0 !important; pointer-events: none; }
        /* ── Fullscreen base ── */
        .canvas-wrapper:fullscreen,
        .canvas-wrapper:-webkit-full-screen {
          background: #111827 !important;
          border-radius: 0 !important;
          aspect-ratio: unset !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: visible !important;
        }
        .canvas-wrapper:fullscreen .fs-canvas-area,
        .canvas-wrapper:-webkit-full-screen .fs-canvas-area {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .canvas-wrapper:fullscreen canvas,
        .canvas-wrapper:-webkit-full-screen canvas {
          max-height: calc(100vh - 60px);
          max-width: 100vw;
          width: auto !important;
          height: auto !important;
          aspect-ratio: 16/9;
          object-fit: contain;
          cursor: crosshair;
        }
        /* ── Mini toolbar (only rendered when in fullscreen) ── */
        .fs-toolbar {
          width: 100%;
          background: rgba(15,23,42,0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 5px 10px;
          flex-wrap: nowrap;
          overflow-x: auto;
          flex-shrink: 0;
          animation: fsToolbarIn 0.25s ease-out;
        }
        .fs-toolbar button {
          font-family: var(--font-nunito), Nunito, sans-serif;
          font-weight: 700;
          font-size: 0.72rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .fs-swatch {
          width: 26px; height: 26px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .fs-swatch.active {
          border-color: white;
          transform: scale(1.2);
          box-shadow: 0 0 0 2px rgba(255,255,255,0.35);
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .canvas-host { touch-action: none; display: block; }
        .canvas-wrapper { position: relative; }
      `}</style>

            <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#f0f4ff 0%,#f8fafc 60%)", display: "flex", flexDirection: "column", fontFamily: "var(--font-inter),Inter,sans-serif" }}>

                {/* ── TOP BAR ── */}
                <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid #e2e8f0", padding: "0.6rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", animation: "fadeSlideIn 0.4s ease-out both" }}>
                    <a href="/" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", flexShrink: 0 }}>
                        <span style={{ fontSize: "1.3rem" }}>🎨</span>
                        <span style={{ fontFamily: "var(--font-nunito),Nunito,sans-serif", fontWeight: 900, fontSize: "1.05rem", background: "linear-gradient(135deg,#6366f1,#22c55e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>DrawTogether</span>
                    </a>

                    <span style={{ width: 1, height: 28, background: "#e2e8f0", flexShrink: 0 }} />

                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f1f5f9", borderRadius: 8, padding: "4px 12px", fontFamily: "var(--font-nunito),Nunito,sans-serif" }}>
                        <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Room</span>
                        <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a", letterSpacing: 2 }}>{roomIdDisplay}</span>
                    </div>

                    <button id="copy-invite-link-btn" onClick={copyLink} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.45rem 1rem", background: copied ? "#d1fae5" : "white", border: `1.5px solid ${copied ? "#22c55e" : "#e2e8f0"}`, borderRadius: 9999, fontFamily: "var(--font-nunito),Nunito,sans-serif", fontWeight: 700, fontSize: "0.82rem", color: copied ? "#16a34a" : "#334155", cursor: "pointer", transition: "all 0.25s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flexShrink: 0 }}>
                        {copied ? "✅ Copied!" : "🔗 Copy Invite Link"}
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
                        <PlayerBadge label="Player 1" status="connected" color="#6366f1" />
                        <PlayerBadge label="Player 2" status={player2Status} color="#22c55e" />
                        <WsStatusDot status={wsStatus} />
                    </div>
                </header>

                {/* ── MAIN ── */}
                <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "1.25rem 1rem", gap: "1rem" }}>

                    {/* Activity pill */}
                    <div key={activityMsg} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 18px", background: player2Status === "connected" ? "#d1fae5" : "#fef9c3", border: `1.5px solid ${player2Status === "connected" ? "#86efac" : "#fde68a"}`, borderRadius: 9999, fontSize: "0.82rem", fontWeight: 600, color: player2Status === "connected" ? "#15803d" : "#92400e", animation: "fadeSlideIn 0.35s ease-out" }}>
                        <span>{player2Status === "connected" ? "🟢" : "⏳"}</span>
                        {activityMsg}
                    </div>

                    {/* ── CANVAS ── */}
                    <div
                        ref={canvasWrapperRef}
                        className="canvas-wrapper"
                        style={{ width: "100%", maxWidth: 960, background: "white", borderRadius: 16, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07),0 20px 50px rgba(99,102,241,0.08),0 0 0 1px rgba(99,102,241,0.1)", overflow: "hidden", aspectRatio: "16/9", position: "relative" }}
                    >
                        {/* Canvas area wrapper — in fullscreen this flexes to fill */}
                        <div className="fs-canvas-area" style={{ position: "relative", width: "100%", height: "100%" }}>
                            <canvas
                                ref={canvasRef}
                                width={1280}
                                height={720}
                                className="canvas-host"
                                style={{ width: "100%", height: "100%", cursor: cursorMap[activeTool] }}
                                onMouseDown={startDraw}
                                onMouseMove={draw}
                                onMouseUp={(e) => { endDraw(e); handleCanvasClick(e); }}
                                onMouseLeave={endDraw}
                                onTouchStart={startDraw}
                                onTouchMove={draw}
                                onTouchEnd={(e) => { endDraw(e); }}
                                onClick={handleCanvasClick}
                            />

                            {/* Fullscreen toggle button — always top-right of canvas area */}
                            <button
                                id="fullscreen-btn"
                                onClick={toggleFullscreen}
                                title={isFullscreen ? "Exit Fullscreen (Esc)" : "Go Fullscreen"}
                                style={{ position: "absolute", top: 10, right: 10, width: 38, height: 38, borderRadius: "0.6rem", border: "1.5px solid rgba(255,255,255,0.5)", background: isFullscreen ? "rgba(30,30,50,0.75)" : "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,0.18)", transition: "all 0.2s ease", zIndex: 20, color: isFullscreen ? "white" : "#334155" }}
                            >
                                {isFullscreen ? "🗗" : "⛶"}
                            </button>

                            {/* Canvas hint overlay */}
                            <div
                                className={hasDrawn ? "canvas-hint-hidden" : "canvas-hint-visible"}
                                style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, transition: "opacity 0.7s ease" }}
                            >
                                <span style={{ fontSize: "4rem" }}>✏️</span>
                                <span style={{ fontFamily: "var(--font-nunito),Nunito,sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#94a3b8" }}>Share the link — then start drawing together!</span>
                            </div>

                            {/* Mirror axis guide — CSS overlay, never touches canvas pixels */}
                            {activeTool === "mirror" && (
                                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", justifyContent: "center" }}>
                                    <div style={{ width: 1, height: "100%", borderLeft: `2px dashed ${color}55`, background: "transparent" }} />
                                </div>
                            )}

                            {/* Fullscreen: toggle toolbar button (always visible) + "show tools" pill */}
                            {isFullscreen && (
                                <>
                                    <button
                                        title={showFsToolbar ? "Hide tools" : "Show tools"}
                                        onClick={() => setShowFsToolbar(v => !v)}
                                        style={{ position: "absolute", bottom: 12, left: 12, width: 40, height: 40, borderRadius: "0.6rem", border: showFsToolbar ? "1.5px solid rgba(99,102,241,0.6)" : "1.5px solid rgba(255,255,255,0.35)", background: showFsToolbar ? "rgba(99,102,241,0.3)" : "rgba(15,23,42,0.75)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", color: "white", fontSize: "1.1rem", cursor: "pointer", zIndex: 25, display: "flex", alignItems: "center", justifyContent: "center" }}
                                    >
                                        🔧
                                    </button>
                                    {!showFsToolbar && (
                                        <div style={{ position: "absolute", bottom: 12, left: 60, background: "rgba(15,23,42,0.8)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", color: "#94a3b8", fontSize: "0.72rem", fontWeight: 600, padding: "6px 12px", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.1)", pointerEvents: "none", fontFamily: "var(--font-nunito),Nunito,sans-serif" }}>
                                            Tap 🔧 to show tools
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* ── MINI FLOATING TOOLBAR (only shown in fullscreen when toggled on) ── */}
                        {isFullscreen && showFsToolbar && (
                            <div className="fs-toolbar">

                                {/* Tool quick-pick */}
                                {TOOLS.filter(t => ["pen", "neon", "rainbow", "spray", "mirror", "glitter", "eraser"].includes(t.id)).map(t => (
                                    <button
                                        key={t.id}
                                        title={t.desc}
                                        onClick={() => selectTool(t.id)}
                                        style={{
                                            width: 40, height: 40,
                                            borderRadius: "0.6rem",
                                            border: activeTool === t.id ? "2px solid #6366f1" : "1.5px solid rgba(255,255,255,0.12)",
                                            background: activeTool === t.id ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.07)",
                                            color: "white",
                                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                            gap: 1, padding: "2px",
                                        }}
                                    >
                                        <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{t.icon}</span>
                                        <span style={{ fontSize: "0.55rem", color: activeTool === t.id ? "#a5b4fc" : "#94a3b8" }}>{t.label}</span>
                                    </button>
                                ))}

                                {/* Divider */}
                                <span style={{ width: 1, height: 32, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

                                {/* Fill + stamps */}
                                {TOOLS.filter(t => ["fill", "star", "heart", "circle"].includes(t.id)).map(t => (
                                    <button
                                        key={t.id}
                                        title={t.desc}
                                        onClick={() => selectTool(t.id)}
                                        style={{
                                            width: 40, height: 40,
                                            borderRadius: "0.6rem",
                                            border: activeTool === t.id ? "2px solid #22c55e" : "1.5px solid rgba(255,255,255,0.12)",
                                            background: activeTool === t.id ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)",
                                            color: "white",
                                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                            gap: 1, padding: "2px",
                                        }}
                                    >
                                        <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{t.icon}</span>
                                        <span style={{ fontSize: "0.55rem", color: activeTool === t.id ? "#86efac" : "#94a3b8" }}>{t.label}</span>
                                    </button>
                                ))}

                                <span style={{ width: 1, height: 32, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

                                {/* Color swatches */}
                                {COLORS.slice(0, 8).map(c => (
                                    <button
                                        key={c.value}
                                        title={c.name}
                                        className={`fs-swatch${color === c.value ? " active" : ""}`}
                                        onClick={() => setColor(c.value)}
                                        style={{ background: c.value }}
                                    />
                                ))}
                                {/* Custom color */}
                                <label title="Custom color" className="fs-swatch" style={{ background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                                    <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer", width: "100%", height: "100%" }} />
                                </label>

                                <span style={{ width: 1, height: 32, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

                                {/* Brush sizes */}
                                {BRUSH_SIZES.map(b => (
                                    <button
                                        key={b.value}
                                        title={`${b.value}px`}
                                        onClick={() => setBrushSize(b.value)}
                                        style={{
                                            width: 34, height: 34,
                                            borderRadius: "0.5rem",
                                            border: brushSize === b.value ? "2px solid #6366f1" : "1.5px solid rgba(255,255,255,0.12)",
                                            background: brushSize === b.value ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.07)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                        }}
                                    >
                                        <span style={{ width: Math.max(b.value * 0.55, 3), height: Math.max(b.value * 0.55, 3), borderRadius: "50%", background: brushSize === b.value ? "#818cf8" : "#64748b", display: "inline-block" }} />
                                    </button>
                                ))}

                                <span style={{ width: 1, height: 32, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

                                {/* Undo / Redo */}
                                <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ width: 40, height: 40, borderRadius: "0.6rem", border: "1.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.07)", color: canUndo ? "white" : "#475569", opacity: canUndo ? 1 : 0.4, fontSize: "1rem" }}>↩</button>
                                <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={{ width: 40, height: 40, borderRadius: "0.6rem", border: "1.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.07)", color: canRedo ? "white" : "#475569", opacity: canRedo ? 1 : 0.4, fontSize: "1rem" }}>↪</button>

                                {/* Exit fullscreen */}
                                <button onClick={toggleFullscreen} title="Exit Fullscreen" style={{ marginLeft: 4, width: 40, height: 40, borderRadius: "0.6rem", border: "1.5px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontSize: "0.95rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    🗗
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── TOOLS PANEL ── */}
                    <div style={{ width: "100%", maxWidth: 960, background: "white", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", padding: "0.9rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>

                        {/* Row 1: Tool selector */}
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>

                            {/* Group labels + buttons */}
                            {(["brush", "utility", "shape"] as const).map((group) => (
                                <div key={group} style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#cbd5e1", textTransform: "uppercase", letterSpacing: 1.5, paddingRight: 4, borderRight: "1px solid #f1f5f9", marginRight: 2, fontFamily: "var(--font-nunito),Nunito,sans-serif" }}>
                                        {group === "brush" ? "Brushes" : group === "utility" ? "Utility" : "Stamps"}
                                    </span>
                                    {TOOLS.filter(t => t.group === group).map(tool => (
                                        <ToolBtn
                                            key={tool.id}
                                            tool={tool}
                                            activeTool={activeTool}
                                            onSelect={selectTool}
                                            isNeonActive={isNeon}
                                            neonColor={color}
                                        />
                                    ))}
                                    {group !== "shape" && <span style={{ width: 1, height: 36, background: "#f1f5f9", marginLeft: 4 }} />}
                                </div>
                            ))}
                        </div>

                        {/* Row 2: Color + Size + Actions */}
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem" }}>

                            {/* Color picker */}
                            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.2, fontFamily: "var(--font-nunito),Nunito,sans-serif" }}>Color</span>
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                    {COLORS.map((c) => (
                                        <button key={c.value} title={c.name}
                                            onClick={() => setColor(c.value)}
                                            style={{ width: 24, height: 24, borderRadius: "50%", background: c.value, border: color === c.value ? "2.5px solid #6366f1" : "2px solid #e2e8f0", cursor: "pointer", transition: "all 0.15s ease", boxShadow: color === c.value ? `0 0 0 3px #c7d2fe, 0 0 0 5px ${c.value}33` : "0 1px 3px rgba(0,0,0,0.1)", transform: color === c.value ? "scale(1.25)" : "scale(1)" }}
                                        />
                                    ))}
                                    {/* Custom */}
                                    <label title="Custom color" style={{ width: 24, height: 24, borderRadius: "50%", background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)", border: "2px solid #e2e8f0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer", width: "100%", height: "100%" }} />
                                    </label>
                                </div>
                            </div>

                            <span style={{ width: 1, height: 32, background: "#f1f5f9", flexShrink: 0 }} />

                            {/* Brush size */}
                            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.2, fontFamily: "var(--font-nunito),Nunito,sans-serif" }}>Size</span>
                                <div style={{ display: "flex", gap: 4 }}>
                                    {BRUSH_SIZES.map((b) => (
                                        <button key={b.value} title={`${b.value}px`}
                                            onClick={() => setBrushSize(b.value)}
                                            style={{ width: 34, height: 34, borderRadius: "0.55rem", border: brushSize === b.value ? "2px solid #6366f1" : "1.5px solid #e2e8f0", background: brushSize === b.value ? "#ede9fe" : "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease", boxShadow: brushSize === b.value ? "0 0 0 2px #c7d2fe" : "none" }}
                                        >
                                            <span style={{ width: Math.max(b.value * 0.6, 3), height: Math.max(b.value * 0.6, 3), borderRadius: "50%", background: brushSize === b.value ? "#6366f1" : "#94a3b8", display: "inline-block", transition: "all 0.15s ease" }} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <span style={{ width: 1, height: 32, background: "#f1f5f9", flexShrink: 0 }} />

                            {/* Undo / Redo */}
                            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                                <button
                                    id="undo-btn"
                                    onClick={undo}
                                    disabled={!canUndo}
                                    title="Undo (Ctrl+Z)"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0.5rem 0.9rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", background: canUndo ? "white" : "#f8fafc", color: canUndo ? "#334155" : "#cbd5e1", fontFamily: "var(--font-nunito),Nunito,sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: canUndo ? "pointer" : "default", transition: "all 0.2s ease", opacity: canUndo ? 1 : 0.5 }}
                                >
                                    ↩ Undo
                                </button>
                                <button
                                    id="redo-btn"
                                    onClick={redo}
                                    disabled={!canRedo}
                                    title="Redo (Ctrl+Y)"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0.5rem 0.9rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", background: canRedo ? "white" : "#f8fafc", color: canRedo ? "#334155" : "#cbd5e1", fontFamily: "var(--font-nunito),Nunito,sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: canRedo ? "pointer" : "default", transition: "all 0.2s ease", opacity: canRedo ? 1 : 0.5 }}
                                >
                                    ↪ Redo
                                </button>
                            </div>

                            <span style={{ width: 1, height: 32, background: "#f1f5f9", flexShrink: 0 }} />

                            {/* Clear */}
                            <button
                                onClick={clearCanvas}
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", borderRadius: "0.65rem", border: "1.5px solid #fecaca", background: "white", color: "#ef4444", fontFamily: "var(--font-nunito),Nunito,sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", transition: "all 0.2s ease" }}
                            >
                                🗑️ Clear
                            </button>

                            {/* Download */}
                            <button
                                id="download-drawing-btn"
                                onClick={downloadCanvas}
                                style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, padding: "0.6rem 1.35rem", background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "white", border: "none", borderRadius: 9999, fontFamily: "var(--font-nunito),Nunito,sans-serif", fontWeight: 800, fontSize: "0.88rem", cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.35)", transition: "all 0.2s ease", flexShrink: 0 }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(99,102,241,0.45)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(99,102,241,0.35)"; }}
                            >
                                ⬇️ Download Drawing
                            </button>
                        </div>

                        {/* Row 3: Active tool preview bar */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.45rem 0.9rem", borderRadius: 10, background: isNeon ? "#080818" : activeTool === "rainbow" ? "linear-gradient(90deg,#ff000033,#ffff0033,#00ff0033,#00ffff33,#0000ff33,#ff00ff33)" : "#f8fafc", border: "1px solid #f1f5f9", transition: "background 0.3s ease" }}>
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: isNeon ? "#64748b" : "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "var(--font-nunito),Nunito,sans-serif" }}>Active Tool</span>

                            {/* Dot preview */}
                            <span
                                className={isNeon ? "preview-neon" : activeTool === "rainbow" ? "preview-rainbow" : ""}
                                style={{
                                    width: Math.min(Math.max(isNeon ? activeSize * 0.6 : activeSize, 6), 32),
                                    height: Math.min(Math.max(isNeon ? activeSize * 0.6 : activeSize, 6), 32),
                                    borderRadius: "50%",
                                    background: isEraser ? "#e2e8f0" : isNeon ? "#ffffff" : activeTool === "rainbow" ? "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)" : previewColor,
                                    border: isEraser ? "1.5px dashed #94a3b8" : "none",
                                    display: "inline-block",
                                    flexShrink: 0,
                                    transition: "all 0.2s ease",
                                    boxShadow: previewGlow,
                                    "--neon-c": color,
                                } as React.CSSProperties}
                            />

                            <span style={{ fontWeight: 700, fontSize: "0.82rem", color: isNeon ? color : activeTool === "rainbow" ? "#7c3aed" : "#334155", fontFamily: "var(--font-nunito),Nunito,sans-serif" }}>
                                {TOOLS.find(t => t.id === activeTool)?.icon} {TOOLS.find(t => t.id === activeTool)?.label}
                                {activeTool !== "rainbow" && activeTool !== "fill" && <> · {activeColor.toUpperCase()}</>}
                                {" · "}{activeSize}px
                            </span>

                            {activeTool === "fill" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Click anywhere on the canvas to fill</span>
                            )}
                            {(activeTool === "star" || activeTool === "heart" || activeTool === "circle") && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Click to stamp</span>
                            )}
                            {activeTool === "mirror" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Draws mirrored across the canvas centre · 🪞</span>
                            )}
                            {activeTool === "glitter" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Hold &amp; drag to scatter sparkles ✨</span>
                            )}
                            {/* Undo / Redo hint */}
                            <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "#cbd5e1", fontFamily: "var(--font-nunito),Nunito,sans-serif" }}>
                                Ctrl+Z undo &nbsp;·&nbsp; Ctrl+Y redo
                            </span>
                        </div>
                    </div>

                </main>

                {/* ── FOOTER ── */}
                <footer style={{ textAlign: "center", padding: "0.75rem 1rem", fontSize: "0.75rem", color: "#94a3b8", borderTop: "1px solid #f1f5f9", background: "white" }}>
                    🎨 DrawTogether · Room <strong style={{ color: "#6366f1" }}>#{roomIdDisplay}</strong> ·{" "}
                    <a href="/" style={{ color: "#6366f1", textDecoration: "none", fontWeight: 600 }}>← Back to Home</a>
                </footer>

            </div>
        </>
    );
}
