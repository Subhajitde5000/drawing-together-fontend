"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ToolName =
    | "pen"
    | "neon"
    | "rainbow"
    | "spray"
    | "mirror"
    | "glitter"
    | "chalk"
    | "fire"
    | "bubble"
    | "zigzag"
    | "kaleidoscope"
    | "lightning"
    | "fur"
    | "splatter"
    | "ribbon"
    | "confetti"
    | "watercolor"
    | "mosaic"
    | "fill"
    | "eraser"
    | "star"
    | "heart"
    | "circle"
    | "diamond"
    | "triangle"
    | "arrow"
    | "spiral";

type DrawEvent = {
    type: "draw" | "end" | "clear" | "fill" | "stamp"
        | "connected" | "player_joined" | "player_left" | "error" | "cursor"
        | "draw_history_sync";
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
    history?: DrawEvent[]; // for draw_history_sync
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
    { id: "chalk", icon: "🖍️", label: "Chalk", desc: "Rough chalky texture with dust", group: "brush" },
    { id: "fire", icon: "🔥", label: "Fire", desc: "Flame particles drifting upward", group: "brush" },
    { id: "bubble", icon: "🫧", label: "Bubble", desc: "Glowing hollow bubbles", group: "brush" },
    { id: "zigzag", icon: "〰️", label: "Zigzag", desc: "Sawtooth stroke pattern", group: "brush" },
    { id: "kaleidoscope", icon: "🔮", label: "Kaleido", desc: "8-way radial symmetry", group: "brush" },
    { id: "lightning", icon: "🌩️", label: "Lightning", desc: "Recursive branching bolt", group: "brush" },
    { id: "fur", icon: "🐡", label: "Fur", desc: "Bristle brush strokes", group: "brush" },
    { id: "splatter", icon: "💥", label: "Splatter", desc: "Jackson Pollock paint drops", group: "brush" },
    { id: "ribbon", icon: "🎀", label: "Ribbon", desc: "Gradient ribbon stroke", group: "brush" },
    { id: "confetti", icon: "🎊", label: "Confetti", desc: "Colorful rotating rectangles", group: "brush" },
    { id: "watercolor", icon: "💧", label: "Watercolor", desc: "Soft layered washes", group: "brush" },
    { id: "mosaic", icon: "⬛", label: "Mosaic", desc: "Snap-to-grid tile painting", group: "brush" },
    { id: "fill", icon: "🪣", label: "Fill", desc: "Flood-fill an enclosed area", group: "utility" },
    { id: "eraser", icon: "🧹", label: "Eraser", desc: "Erase to white", group: "utility" },
    { id: "star", icon: "⭐", label: "Star", desc: "Stamp a 5-point star", group: "shape" },
    { id: "heart", icon: "❤️", label: "Heart", desc: "Stamp a heart", group: "shape" },
    { id: "circle", icon: "⬤", label: "Circle", desc: "Stamp a filled circle", group: "shape" },
    { id: "diamond", icon: "💎", label: "Diamond", desc: "Stamp a diamond gem", group: "shape" },
    { id: "triangle", icon: "🔺", label: "Triangle", desc: "Stamp a triangle", group: "shape" },
    { id: "arrow", icon: "➡️", label: "Arrow", desc: "Stamp an arrow", group: "shape" },
    { id: "spiral", icon: "🌀", label: "Spiral", desc: "Stamp a spiral", group: "shape" },
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

/** Chalk — rough textured strokes with dust particles */
function applyChalk(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number, toX: number, toY: number,
    color: string, size: number
) {
    const rgb = hexToRgb(color);
    const dx = toX - fromX, dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const steps = Math.max(1, Math.floor(dist / 2));
    ctx.save();
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = fromX + dx * t;
        const cy = fromY + dy * t;
        // Main chalk strand
        for (let s = 0; s < 6; s++) {
            const ox = (Math.random() - 0.5) * size * 1.2;
            const oy = (Math.random() - 0.5) * size * 1.2;
            const alpha = 0.3 + Math.random() * 0.45;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
            ctx.fillRect(cx + ox, cy + oy, Math.random() * size * 0.5 + 0.5, Math.random() * 2 + 0.5);
        }
        // Dust specks
        if (Math.random() < 0.35) {
            ctx.globalAlpha = 0.15 + Math.random() * 0.2;
            ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
            ctx.beginPath();
            ctx.arc(cx + (Math.random() - 0.5) * size * 3, cy + (Math.random() - 0.5) * size * 3, Math.random() * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

const FIRE_PALETTE = ["#fff7aa", "#ffe666", "#ffb300", "#ff6a00", "#ff2200", "#cc0000"];

/** Fire — upward drifting flame particles */
function applyFire(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    size: number
) {
    ctx.save();
    const count = Math.max(12, size * 4);
    for (let i = 0; i < count; i++) {
        const fc = FIRE_PALETTE[Math.floor(Math.random() * FIRE_PALETTE.length)];
        const r = (Math.random() * size * 1.5) + size * 0.3;
        const angle = Math.random() * Math.PI * 2;
        const px = x + Math.cos(angle) * r * 0.6;
        const py = y + Math.sin(angle) * r * 0.3 - Math.random() * size * 2.5; // drift upward
        const pr = Math.random() * size * 0.9 + 1;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
        grad.addColorStop(0, fc);
        grad.addColorStop(1, "rgba(255,100,0,0)");
        ctx.globalAlpha = 0.55 + Math.random() * 0.45;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/** Bubble — spaced hollow glowing circles */
function applyBubble(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number, toX: number, toY: number,
    color: string, size: number
) {
    const rgb = hexToRgb(color);
    const dx = toX - fromX, dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const spacing = size * 2.2;
    const steps = Math.max(1, Math.floor(dist / spacing));
    ctx.save();
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = fromX + dx * t;
        const cy = fromY + dy * t;
        const r = size * 1.4;
        // Outer glow
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
        ctx.lineWidth = size * 0.6;
        ctx.shadowColor = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
        ctx.shadowBlur = size * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        // Main bubble ring
        ctx.globalAlpha = 0.65;
        ctx.shadowBlur = size;
        ctx.lineWidth = size * 0.35;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        // Highlight
        ctx.globalAlpha = 0.7;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = size * 0.18;
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.3, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

/** Zigzag — sawtooth pattern perpendicular to stroke */
function applyZigzag(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number, toX: number, toY: number,
    color: string, size: number
) {
    const dx = toX - fromX, dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / dist, ny = dx / dist; // perpendicular unit vector
    const amplitude = size * 2.5;
    const wavelength = size * 3;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const steps = Math.max(2, Math.floor(dist / (wavelength / 2)));
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const bx = fromX + dx * t;
        const by = fromY + dy * t;
        const flip = i % 2 === 0 ? 1 : -1;
        const px = bx + nx * amplitude * flip;
        const py = by + ny * amplitude * flip;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
}

/** Kaleidoscope — 8-way radial symmetry around canvas center */
function applyKaleidoscope(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    fromX: number, fromY: number, toX: number, toY: number,
    color: string, size: number
) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const segments = 8;
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < segments; i++) {
        const angle = (Math.PI * 2 * i) / segments;
        ctx.save();
        ctx.rotate(angle);
        // Draw both the stroke and its mirror
        for (const [fx, fy, tx, ty] of [[fromX - cx, fromY - cy, toX - cx, toY - cy], [-(fromX - cx), fromY - cy, -(toX - cx), toY - cy]]) {
            ctx.beginPath();
            ctx.moveTo(fx as number, fy as number);
            ctx.lineTo(tx as number, ty as number);
            ctx.strokeStyle = color;
            ctx.lineWidth = size;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.shadowColor = color;
            ctx.shadowBlur = size * 1.5;
            ctx.globalAlpha = 0.7;
            ctx.stroke();
        }
        ctx.restore();
    }
    ctx.restore();
}

/** Recursive lightning bolt segment */
function _lightningSegment(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number, x2: number, y2: number,
    depth: number, color: string, width: number
) {
    if (depth <= 0 || width < 0.3) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return;
    }
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * (Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * 0.5);
    const my = (y1 + y2) / 2 + (Math.random() - 0.5) * (Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * 0.5);
    ctx.lineWidth = width;
    _lightningSegment(ctx, x1, y1, mx, my, depth - 1, color, width * 0.65);
    _lightningSegment(ctx, mx, my, x2, y2, depth - 1, color, width * 0.65);
    // Occasional branch
    if (Math.random() < 0.4) {
        const bx = mx + (Math.random() - 0.5) * 80;
        const by = my + (Math.random() - 0.5) * 80;
        ctx.lineWidth = width * 0.4;
        _lightningSegment(ctx, mx, my, bx, by, depth - 2, color, width * 0.4);
    }
}

/** Lightning — recursive branching bolt */
function applyLightning(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number, toX: number, toY: number,
    color: string, size: number
) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 4;
    ctx.globalAlpha = 0.9;
    ctx.lineCap = "round";
    _lightningSegment(ctx, fromX, fromY, toX, toY, 3, color, size);
    // White-hot core
    ctx.shadowBlur = size;
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = size * 0.3;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.restore();
}

/** Fur — bristle brush perpendicular to stroke */
function applyFur(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number, toX: number, toY: number,
    color: string, size: number
) {
    const rgb = hexToRgb(color);
    const dx = toX - fromX, dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / dist, ny = dx / dist;
    const steps = Math.max(1, Math.floor(dist / 2));
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = fromX + dx * t;
        const cy = fromY + dy * t;
        const bristles = Math.max(6, size * 2);
        for (let b = 0; b < bristles; b++) {
            const spread = (Math.random() - 0.5) * size * 2;
            const length = (Math.random() * 0.6 + 0.4) * size * 2.5;
            const alpha = 0.25 + Math.random() * 0.55;
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
            ctx.lineWidth = Math.random() * 1.2 + 0.4;
            ctx.beginPath();
            ctx.moveTo(cx + nx * spread, cy + ny * spread);
            ctx.lineTo(cx + nx * (spread + length), cy + ny * (spread + length));
            ctx.stroke();
        }
    }
    ctx.restore();
}

/** Splatter — Jackson Pollock-style paint drops */
function applySplatter(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    color: string, size: number
) {
    const rgb = hexToRgb(color);
    const drops = Math.max(8, size * 3);
    ctx.save();
    for (let i = 0; i < drops; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * size * 18;
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist * 0.7; // slight vertical squash
        const r = Math.random() * size * 0.8 + 0.5;
        ctx.globalAlpha = 0.55 + Math.random() * 0.45;
        ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        // Tail (elongated drip toward center)
        if (Math.random() < 0.4 && dist > size * 3) {
            const tx = x + Math.cos(angle) * (dist * 0.5);
            const ty = y + Math.sin(angle) * (dist * 0.5) * 0.7;
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
            ctx.lineWidth = r * 0.8;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(tx, ty);
            ctx.stroke();
        }
    }
    ctx.restore();
}

/** Ribbon — gradient filled band along stroke */
function applyRibbon(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number, toX: number, toY: number,
    color: string, size: number
) {
    const rgb = hexToRgb(color);
    const dx = toX - fromX, dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / dist) * size * 1.5, ny = (dx / dist) * size * 1.5;
    ctx.save();
    // Main ribbon body
    const grad = ctx.createLinearGradient(fromX + nx, fromY + ny, fromX - nx, fromY - ny);
    grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`);
    grad.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},0.9)`);
    grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(fromX + nx, fromY + ny);
    ctx.lineTo(toX + nx, toY + ny);
    ctx.lineTo(toX - nx, toY - ny);
    ctx.lineTo(fromX - nx, fromY - ny);
    ctx.closePath();
    ctx.fill();
    // Highlight
    ctx.strokeStyle = `rgba(255,255,255,0.55)`;
    ctx.lineWidth = size * 0.35;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fromX + nx * 0.3, fromY + ny * 0.3);
    ctx.lineTo(toX + nx * 0.3, toY + ny * 0.3);
    ctx.stroke();
    ctx.restore();
}

/** Confetti — rotating colorful rectangle bursts */
function applyConfetti(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    color: string, size: number
) {
    const baseRgb = hexToRgb(color);
    const count = Math.max(10, size * 3);
    const confettiColors = [
        color,
        `hsl(${(parseInt(color.slice(1, 3), 16)) % 360 + 60},100%,55%)`,
        `hsl(${(parseInt(color.slice(1, 3), 16)) % 360 + 120},100%,55%)`,
        `hsl(${(parseInt(color.slice(1, 3), 16)) % 360 + 180},100%,55%)`,
        "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff",
    ];
    ctx.save();
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * size * 10;
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;
        const rot = Math.random() * Math.PI;
        const w = size * (0.5 + Math.random() * 1.2);
        const h = size * (0.25 + Math.random() * 0.5);
        const c = confettiColors[Math.floor(Math.random() * confettiColors.length)];
        ctx.globalAlpha = 0.7 + Math.random() * 0.3;
        ctx.fillStyle = c;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
    }
    ctx.restore();
}

/** Watercolor — layered semi-transparent blobs */
function applyWatercolor(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number, toX: number, toY: number,
    color: string, size: number
) {
    const rgb = hexToRgb(color);
    ctx.save();
    for (let layer = 0; layer < 5; layer++) {
        const ox = (Math.random() - 0.5) * size * 1.5;
        const oy = (Math.random() - 0.5) * size * 1.5;
        const sw = size * (1.5 + Math.random() * 2);
        ctx.globalAlpha = 0.04 + Math.random() * 0.08;
        ctx.strokeStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
        ctx.lineWidth = sw;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
        ctx.shadowBlur = sw * 0.5;
        ctx.beginPath();
        ctx.moveTo(fromX + ox, fromY + oy);
        ctx.lineTo(toX + ox, toY + oy);
        ctx.stroke();
    }
    ctx.restore();
}

/** Mosaic — snaps to grid cells */
function applyMosaic(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    color: string, size: number
) {
    const cellSize = Math.max(size * 2, 8);
    const gx = Math.floor(x / cellSize) * cellSize;
    const gy = Math.floor(y / cellSize) * cellSize;
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(gx, gy, cellSize, cellSize);
    // Subtle highlight edge
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, cellSize, cellSize);
    ctx.restore();
}

/** Diamond stamp */
function applyDiamondStamp(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    color: string, size: number
) {
    const r = size * 2.5;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.65, cy - r * 0.2);
    ctx.lineTo(cx + r * 0.65, cy + r * 0.2);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.65, cy + r * 0.2);
    ctx.lineTo(cx - r * 0.65, cy - r * 0.2);
    ctx.closePath();
    ctx.fill();
    // Shine
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.2, cy - r * 0.85);
    ctx.lineTo(cx + r * 0.35, cy - r * 0.2);
    ctx.lineTo(cx, cy - r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

/** Triangle stamp */
function applyTriangleStamp(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    color: string, size: number
) {
    const r = size * 2.5;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.87, cy + r * 0.5);
    ctx.lineTo(cx - r * 0.87, cy + r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

/** Arrow stamp */
function applyArrowStamp(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    color: string, size: number
) {
    const s = size * 2;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx + s, cy);           // tip
    ctx.lineTo(cx, cy - s * 0.6);    // top wing
    ctx.lineTo(cx, cy - s * 0.25);   // inner top
    ctx.lineTo(cx - s, cy - s * 0.25); // tail top
    ctx.lineTo(cx - s, cy + s * 0.25); // tail bottom
    ctx.lineTo(cx, cy + s * 0.25);    // inner bottom
    ctx.lineTo(cx, cy + s * 0.6);    // bottom wing
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

/** Spiral stamp */
function applySpiralStamp(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    color: string, size: number
) {
    const turns = 3;
    const maxR = size * 2.8;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.5;
    ctx.lineCap = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 2;
    ctx.beginPath();
    const steps = turns * 60;
    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * turns * Math.PI * 2;
        const r = (i / steps) * maxR;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
}

// ── WebSocket hook ────────────────────────────────────────────────────────────

type WsStatus = "connecting" | "connected" | "disconnected" | "full";

const WS_MAX_RETRIES = 12;
const WS_BASE_DELAY_MS = 3000;
// How long to poll the HTTP health endpoint before giving up (ms)
const WAKE_TIMEOUT_MS = 90_000;
const WAKE_POLL_MS = 5_000;

/**
 * Wake the Render dyno, then confirm it's alive.
 *
 * 1. Fire a no-cors "wake" request (avoids CORS console errors while the
 *    dyno is still asleep — Render's 404 proxy page has no CORS headers).
 * 2. Once the no-cors request succeeds (server TCP is up), switch to a
 *    normal CORS fetch to verify we get a real 200 with CORS headers.
 */
async function waitForBackend(httpUrl: string, signal: AbortSignal): Promise<boolean> {
    const deadline = Date.now() + WAKE_TIMEOUT_MS;

    // Phase 1 — fire no-cors pings to wake the dyno without CORS errors
    while (Date.now() < deadline) {
        if (signal.aborted) return false;
        try {
            await fetch(`${httpUrl}/`, { method: "HEAD", mode: "no-cors", cache: "no-store", signal });
            // Opaque response — dyno *might* be up. Move to phase 2.
            break;
        } catch { /* dyno not reachable yet */ }
        await sleep(WAKE_POLL_MS, signal);
    }

    // Phase 2 — confirm with a normal CORS fetch (checks 200 + headers)
    while (Date.now() < deadline) {
        if (signal.aborted) return false;
        try {
            const res = await fetch(`${httpUrl}/`, {
                method: "GET",
                cache: "no-store",
                credentials: "omit",
                signal,
            });
            if (res.ok) return true;
        } catch { /* CORS error = proxy 404, server still booting */ }
        await sleep(WAKE_POLL_MS, signal);
    }
    return false;
}

/** Cancellable sleep helper */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const t = setTimeout(resolve, ms);
        signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
    });
}

function useWebSocket(roomId: string, playerName: string, onMessage: (data: DrawEvent) => void) {
    const wsRef = useRef<WebSocket | null>(null);
    const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
    const retryCount = useRef(0);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        const abortCtrl = new AbortController();
        retryCount.current = 0;

        // Derive HTTP base URL from the WS env var (ws→http, wss→https)
        const wsBase = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
        const httpBase = process.env.NEXT_PUBLIC_API_URL ||
            wsBase.replace(/^wss:/, "https:").replace(/^ws:/, "http:");

        async function connectWithWake() {
            if (abortCtrl.signal.aborted) return;
            setWsStatus("connecting");
            const alive = await waitForBackend(httpBase, abortCtrl.signal);
            if (!alive || abortCtrl.signal.aborted) {
                setWsStatus("disconnected");
                return;
            }
            openSocket();
        }

        function openSocket() {
            if (abortCtrl.signal.aborted) return;
            const ws = new WebSocket(`${wsBase}/ws/${roomId}`);
            wsRef.current = ws;
            setWsStatus("connecting");

            ws.onopen = () => {
                retryCount.current = 0;
                setWsStatus("connected");
                ws.send(JSON.stringify({ type: "join", name: playerName }));
            };

            ws.onclose = (e) => {
                if (e.code === 4000) { setWsStatus("full"); return; }
                if (abortCtrl.signal.aborted) return;
                if (retryCount.current < WS_MAX_RETRIES) {
                    retryCount.current += 1;
                    setWsStatus("disconnected");
                    // Re-check server health before each retry (handles server restart)
                    retryTimer.current = setTimeout(connectWithWake, WS_BASE_DELAY_MS);
                } else {
                    setWsStatus("disconnected");
                }
            };

            ws.onerror = () => { /* onclose fires after onerror */ };
            ws.onmessage = (event) => {
                try { onMessageRef.current(JSON.parse(event.data)); } catch { /* ignore */ }
            };
        }

        // Initial connect: wake the dyno first, then open the WebSocket
        connectWithWake();

        return () => {
            abortCtrl.abort();
            if (retryTimer.current) clearTimeout(retryTimer.current);
            wsRef.current?.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, playerName]);

    const send = useCallback((data: DrawEvent) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    return { wsStatus, send };
}

// ── UI Sub-components ─────────────────────────────────────────────────────────

function WsStatusDot({ status }: { status: WsStatus }) {
    const map: Record<WsStatus, { color: string; label: string }> = {
        connected: { color: "#22c55e", label: "Connected" },
        connecting: { color: "#f59e0b", label: "Connecting…" },
        disconnected: { color: "#ef4444", label: "Disconnected" },
        full: { color: "#ef4444", label: "Room Full" },
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
    const searchParams = useSearchParams();
    const myName = searchParams.get("name") ?? "Player";

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const hueRef = useRef(0);   // for rainbow brush

    // ── Peer cursor
    const peerCursorRef = useRef<HTMLDivElement>(null);
    const lastCursorSendRef = useRef(0);
    const historyRef = useRef<ImageData[]>([]);
    const historyIndexRef = useRef(-1);
    const touchStartRef = useRef<(e: TouchEvent) => void>(() => {});
    const touchMoveRef = useRef<(e: TouchEvent) => void>(() => {});
    const touchEndRef = useRef<(e: TouchEvent) => void>(() => {});
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
        const ctx = ctxRef.current;
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
        const ctx = ctxRef.current;
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
        const ctx = ctxRef.current;
        if (!ctx) return;
        ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0);
        setCanUndo(true);
        setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    }

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Create context once with willReadFrequently so getImageData is fast
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctxRef.current = ctx;
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
            // Hide their cursor
            const ce = peerCursorRef.current;
            if (ce) ce.style.display = "none";
            return;
        }
        if (data.type === "cursor") {
            const ce = peerCursorRef.current;
            if (!ce) return;
            if ((data.x ?? -1) < 0) {
                ce.style.display = "none";
            } else {
                ce.style.display = "block";
                ce.style.left = ((data.x! / 1280) * 100) + "%";
                ce.style.top  = ((data.y! / 720)  * 100) + "%";
            }
            return;
        }
        if (data.type === "connected" || data.type === "error" || data.type === "end") {
            return;
        }

        // ── Replay draw history on reconnect ──
        if (data.type === "draw_history_sync") {
            const canvas = canvasRef.current;
            const ctx = ctxRef.current;
            if (!canvas || !ctx) return;
            const history = data.history;
            if (!history || !Array.isArray(history)) return;
            for (const ev of history) {
                if (ev.type === "clear") {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    fillWhite(ctx, canvas);
                } else if (ev.type === "draw" && ev.fromX !== undefined) {
                    const tool = ev.tool ?? "pen";
                    if (tool === "neon") applyNeon(ctx, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "rainbow") applyRainbow(ctx, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.hue ?? 0, ev.size!);
                    else if (tool === "spray") applySpray(ctx, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "glitter") applyGlitter(ctx, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "mirror") applyMirror(ctx, canvas, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "chalk") applyChalk(ctx, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "fire") applyFire(ctx, ev.x!, ev.y!, ev.size!);
                    else if (tool === "bubble") applyBubble(ctx, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "zigzag") applyZigzag(ctx, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "kaleidoscope") applyKaleidoscope(ctx, canvas, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "lightning") applyLightning(ctx, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "fur") applyFur(ctx, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "splatter") applySplatter(ctx, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "ribbon") applyRibbon(ctx, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "confetti") applyConfetti(ctx, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "watercolor") applyWatercolor(ctx, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.color!, ev.size!);
                    else if (tool === "mosaic") applyMosaic(ctx, ev.x!, ev.y!, ev.color!, ev.size!);
                    else applyLine(ctx, ev.fromX!, ev.fromY!, ev.x!, ev.y!, ev.color!, ev.size!);
                } else if (ev.type === "fill") {
                    applyFloodFill(ctx, canvas, ev.x!, ev.y!, ev.color!);
                } else if (ev.type === "stamp") {
                    const s = ev.size!;
                    if (ev.tool === "star") applyStarStamp(ctx, ev.x!, ev.y!, ev.color!, s);
                    if (ev.tool === "heart") applyHeartStamp(ctx, ev.x!, ev.y!, ev.color!, s);
                    if (ev.tool === "circle") applyCircleStamp(ctx, ev.x!, ev.y!, ev.color!, s);
                    if (ev.tool === "diamond") applyDiamondStamp(ctx, ev.x!, ev.y!, ev.color!, s);
                    if (ev.tool === "triangle") applyTriangleStamp(ctx, ev.x!, ev.y!, ev.color!, s);
                    if (ev.tool === "arrow") applyArrowStamp(ctx, ev.x!, ev.y!, ev.color!, s);
                    if (ev.tool === "spiral") applySpiralStamp(ctx, ev.x!, ev.y!, ev.color!, s);
                }
            }
            // Save restored canvas as new history base
            const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
            historyRef.current = [snap];
            historyIndexRef.current = 0;
            setCanUndo(false);
            setCanRedo(false);
            setActivityMsg("Reconnected — canvas restored!");
            return;
        }

        // ── Canvas drawing events ──
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = ctxRef.current;
        if (!ctx) return;

        if (data.type === "draw" && data.fromX !== undefined) {
            const tool = data.tool ?? "pen";
            if (tool === "neon") applyNeon(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "rainbow") applyRainbow(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.hue ?? 0, data.size!);
            else if (tool === "spray") applySpray(ctx, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "glitter") applyGlitter(ctx, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "mirror") applyMirror(ctx, canvas, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "chalk") applyChalk(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "fire") applyFire(ctx, data.x!, data.y!, data.size!);
            else if (tool === "bubble") applyBubble(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "zigzag") applyZigzag(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "kaleidoscope") applyKaleidoscope(ctx, canvas, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "lightning") applyLightning(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "fur") applyFur(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "splatter") applySplatter(ctx, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "ribbon") applyRibbon(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "confetti") applyConfetti(ctx, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "watercolor") applyWatercolor(ctx, data.fromX!, data.fromY!, data.x!, data.y!, data.color!, data.size!);
            else if (tool === "mosaic") applyMosaic(ctx, data.x!, data.y!, data.color!, data.size!);
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
            if (data.tool === "diamond") applyDiamondStamp(ctx, data.x!, data.y!, data.color!, s);
            if (data.tool === "triangle") applyTriangleStamp(ctx, data.x!, data.y!, data.color!, s);
            if (data.tool === "arrow") applyArrowStamp(ctx, data.x!, data.y!, data.color!, s);
            if (data.tool === "spiral") applySpiralStamp(ctx, data.x!, data.y!, data.color!, s);
        }

        if (data.type === "clear") {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            fillWhite(ctx, canvas);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const router = useRouter();
    const { wsStatus, send } = useWebSocket(roomId, myName, handleRemoteEvent);

    // ── Throttled cursor sender (~30 fps)
    function trackCursor(e: React.MouseEvent | React.TouchEvent) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const now = Date.now();
        if (now - lastCursorSendRef.current < 33) return;
        lastCursorSendRef.current = now;
        const pos = getCanvasCoords(e, canvas);
        send({ type: "cursor", x: pos.x, y: pos.y });
    }

    useEffect(() => {
        if (wsStatus === "full") {
            router.replace("/room-full");
        } else if (wsStatus === "disconnected") {
            setPlayer2Status("waiting");
            setActivityMsg("Connection lost. Reconnecting…");
        }
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
        const ctx = ctxRef.current;
        if (!ctx) return;

        const pos = getCanvasCoords(e, canvas);
        const from = lastPosRef.current ?? pos;

        // Stamp tools: handle on click, not drag
        if (activeTool === "star" || activeTool === "heart" || activeTool === "circle"
            || activeTool === "diamond" || activeTool === "triangle" || activeTool === "arrow" || activeTool === "spiral") {
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
        } else if (activeTool === "chalk") {
            applyChalk(ctx, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "chalk" });
        } else if (activeTool === "fire") {
            applyFire(ctx, pos.x, pos.y, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "fire" });
        } else if (activeTool === "bubble") {
            applyBubble(ctx, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "bubble" });
        } else if (activeTool === "zigzag") {
            applyZigzag(ctx, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "zigzag" });
        } else if (activeTool === "kaleidoscope") {
            applyKaleidoscope(ctx, canvas, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "kaleidoscope" });
        } else if (activeTool === "lightning") {
            applyLightning(ctx, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "lightning" });
        } else if (activeTool === "fur") {
            applyFur(ctx, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "fur" });
        } else if (activeTool === "splatter") {
            applySplatter(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "splatter" });
        } else if (activeTool === "ribbon") {
            applyRibbon(ctx, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "ribbon" });
        } else if (activeTool === "confetti") {
            applyConfetti(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "confetti" });
        } else if (activeTool === "watercolor") {
            applyWatercolor(ctx, from.x, from.y, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "watercolor" });
        } else if (activeTool === "mosaic") {
            applyMosaic(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "draw", fromX: from.x, fromY: from.y, x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "mosaic" });
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
        // On touch, fire stamp/fill since click doesn't fire after preventDefault
        if ("touches" in e || "changedTouches" in e) {
            handleCanvasClick(e);
        }
    }

    // Keep touch handler refs up-to-date (closures change each render)
    touchStartRef.current = (e: TouchEvent) => startDraw(e as unknown as React.TouchEvent);
    touchMoveRef.current = (e: TouchEvent) => { draw(e as unknown as React.TouchEvent); trackCursor(e as unknown as React.TouchEvent); };
    touchEndRef.current = (e: TouchEvent) => endDraw(e as unknown as React.TouchEvent);

    // Register non-passive touch listeners so preventDefault works on mobile
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

    function handleCanvasClick(e: React.MouseEvent | React.TouchEvent | TouchEvent) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = ctxRef.current;
        if (!ctx) return;
        const pos = getCanvasCoords(e as React.MouseEvent | React.TouchEvent, canvas);

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
        } else if (activeTool === "diamond") {
            applyDiamondStamp(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "stamp", x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "diamond" });
        } else if (activeTool === "triangle") {
            applyTriangleStamp(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "stamp", x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "triangle" });
        } else if (activeTool === "arrow") {
            applyArrowStamp(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "stamp", x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "arrow" });
        } else if (activeTool === "spiral") {
            applySpiralStamp(ctx, pos.x, pos.y, activeColor, activeSize);
            send({ type: "stamp", x: pos.x, y: pos.y, color: activeColor, size: activeSize, tool: "spiral" });
        }
    }

    // ── Actions ─────────────────────────────────────────────────────────────────

    function clearCanvas() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = ctxRef.current;
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
        if (id !== "eraser" && id !== "fill" && id !== "star" && id !== "heart" && id !== "circle"
            && id !== "diamond" && id !== "triangle" && id !== "arrow" && id !== "spiral") {
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
                    // TS's ScreenOrientation type may lack lock/unlock in some lib versions
                    (screen.orientation as any)?.lock?.("landscape")?.catch(() => { });
                } catch { /* not supported */ }
            }).catch(() => { });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
                try { (screen.orientation as any)?.unlock?.(); } catch { /* ignore */ }
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
        chalk: "crosshair", fire: "cell", bubble: "crosshair", zigzag: "crosshair",
        kaleidoscope: "crosshair", lightning: "crosshair", fur: "crosshair",
        splatter: "cell", ribbon: "crosshair", confetti: "cell",
        watercolor: "crosshair", mosaic: "crosshair",
        fill: "copy", eraser: "cell",
        star: "copy", heart: "copy", circle: "copy",
        diamond: "copy", triangle: "copy", arrow: "copy", spiral: "copy",
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
          max-height: calc(100vh - 110px);
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
          gap: 4px;
          padding: 5px 8px;
          flex-wrap: wrap;
          overflow-y: auto;
          max-height: 106px;
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
                                style={{ width: "100%", height: "100%", cursor: cursorMap[activeTool], touchAction: "none" }}
                                onMouseDown={startDraw}
                                onMouseMove={(e) => { draw(e); trackCursor(e); }}
                                onMouseUp={(e) => { endDraw(e); handleCanvasClick(e); }}
                                onMouseLeave={(e) => { endDraw(e); send({ type: "cursor", x: -1, y: -1 }); }}
                                onClick={handleCanvasClick}
                            />

                            {/* ── Peer cursor overlay (Canva-style live pointer) ── */}
                            <div
                                ref={peerCursorRef}
                                style={{
                                    display: "none",
                                    position: "absolute",
                                    pointerEvents: "none",
                                    zIndex: 15,
                                    transform: "translate(-3px, -3px)",
                                    transition: "left 0.06s linear, top 0.06s linear",
                                    willChange: "left, top",
                                }}
                            >
                                <svg width="22" height="22" viewBox="0 0 22 22" style={{ display: "block", filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}>
                                    <path d="M4 2L19 11L11 13.5L8.5 19L4 2Z" fill="#22c55e" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                                </svg>
                                <div style={{
                                    background: "#22c55e",
                                    color: "white",
                                    fontSize: "0.62rem",
                                    fontWeight: 800,
                                    padding: "2px 8px",
                                    borderRadius: "9999px",
                                    marginTop: 2,
                                    whiteSpace: "nowrap",
                                    fontFamily: "var(--font-nunito),Nunito,sans-serif",
                                    boxShadow: "0 2px 8px rgba(34,197,94,0.45)",
                                    letterSpacing: "0.3px",
                                }}>
                                    Player 2
                                </div>
                            </div>
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
                                {TOOLS.filter(t => ["pen", "neon", "rainbow", "spray", "mirror", "glitter", "chalk", "fire", "bubble", "zigzag", "kaleidoscope", "lightning", "fur", "splatter", "ribbon", "confetti", "watercolor", "mosaic", "eraser"].includes(t.id)).map(t => (
                                    <button
                                        key={t.id}
                                        title={t.desc}
                                        onClick={() => selectTool(t.id)}
                                        style={{
                                            width: 36, height: 36,
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
                                {TOOLS.filter(t => ["fill", "star", "heart", "circle", "diamond", "triangle", "arrow", "spiral"].includes(t.id)).map(t => (
                                    <button
                                        key={t.id}
                                        title={t.desc}
                                        onClick={() => selectTool(t.id)}
                                        style={{
                                            width: 36, height: 36,
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
                                <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={{ width: 36, height: 36, borderRadius: "0.6rem", border: "1.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.07)", color: canUndo ? "white" : "#475569", opacity: canUndo ? 1 : 0.4, fontSize: "1rem" }}>↩</button>
                                <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={{ width: 36, height: 36, borderRadius: "0.6rem", border: "1.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.07)", color: canRedo ? "white" : "#475569", opacity: canRedo ? 1 : 0.4, fontSize: "1rem" }}>↪</button>

                                {/* Exit fullscreen */}
                                <button onClick={toggleFullscreen} title="Exit Fullscreen" style={{ marginLeft: 4, width: 36, height: 36, borderRadius: "0.6rem", border: "1.5px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontSize: "0.95rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                            {(activeTool === "star" || activeTool === "heart" || activeTool === "circle" || activeTool === "diamond" || activeTool === "triangle" || activeTool === "arrow" || activeTool === "spiral") && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Click to stamp</span>
                            )}
                            {activeTool === "mirror" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Draws mirrored across the canvas centre · 🪞</span>
                            )}
                            {activeTool === "glitter" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Hold &amp; drag to scatter sparkles ✨</span>
                            )}
                            {activeTool === "chalk" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Rough chalky texture with dust particles 🖍️</span>
                            )}
                            {activeTool === "fire" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Hold &amp; drag to paint flames 🔥</span>
                            )}
                            {activeTool === "bubble" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Drag to trail glowing bubbles 🫧</span>
                            )}
                            {activeTool === "zigzag" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Drag to draw a sawtooth zigzag 〰️</span>
                            )}
                            {activeTool === "kaleidoscope" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>8-way symmetry around the canvas center 🔮</span>
                            )}
                            {activeTool === "lightning" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Drag to spark recursive lightning bolts 🌩️</span>
                            )}
                            {activeTool === "fur" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Drag to paint soft fur bristles 🐡</span>
                            )}
                            {activeTool === "splatter" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Hold &amp; drag to splatter paint 💥</span>
                            )}
                            {activeTool === "ribbon" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Drag to paint a gradient ribbon 🎀</span>
                            )}
                            {activeTool === "confetti" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Hold &amp; drag to burst confetti 🎊</span>
                            )}
                            {activeTool === "watercolor" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Drag for soft layered watercolor washes 💧</span>
                            )}
                            {activeTool === "mosaic" && (
                                <span style={{ fontSize: "0.74rem", color: "#94a3b8", marginLeft: 4 }}>Drag to paint snap-to-grid tiles ⬛</span>
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
