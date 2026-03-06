"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// ── Inline SVG Canvas Illustration ──────────────────────────────────────────

function CanvasIllustration() {
  return (
    <div
      className="canvas-illustration animate-float"
      style={{
        width: "100%",
        maxWidth: 420,
        aspectRatio: "4 / 3",
        margin: "0 auto",
      }}
    >
      {/* Toolbar strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "#f1f5f9",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {/* Window dots */}
        {["#ef4444", "#f59e0b", "#22c55e"].map((c, i) => (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: c,
              display: "inline-block",
            }}
          />
        ))}
        <span
          style={{
            marginLeft: 8,
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            letterSpacing: 1,
          }}
        >
          DrawTogether · Room #a9f2
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "#22c55e",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#22c55e",
              display: "inline-block",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          2 players
        </span>
      </div>

      {/* Canvas area */}
      <svg
        viewBox="0 0 420 300"
        style={{ width: "100%", height: "auto", display: "block", background: "#fff" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="420" height="300" fill="url(#grid)" />

        {/* Player 1 drawing — purple path */}
        <path
          d="M 60 200 Q 90 120 130 150 Q 165 175 190 130 Q 210 95 240 110"
          fill="none"
          stroke="#6366f1"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-draw-line"
          style={{ strokeDasharray: 300 }}
        />

        {/* Player 2 drawing — green path */}
        <path
          d="M 200 220 Q 240 180 270 200 Q 300 220 330 170 Q 355 135 380 160"
          fill="none"
          stroke="#22c55e"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-draw-line"
          style={{ strokeDasharray: 300, animationDelay: "0.4s" }}
        />

        {/* A little house doodle */}
        <rect x="155" y="200" width="60" height="45" fill="none" stroke="#f59e0b" strokeWidth="2" rx="2" />
        <polygon points="155,200 185,175 215,200" fill="none" stroke="#f59e0b" strokeWidth="2" />
        <rect x="174" y="220" width="16" height="25" fill="#fef9c3" stroke="#f59e0b" strokeWidth="1.5" />

        {/* Sun doodle */}
        <circle cx="340" cy="60" r="18" fill="none" stroke="#f59e0b" strokeWidth="2" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={340 + 22 * Math.cos(rad)}
              y1={60 + 22 * Math.sin(rad)}
              x2={340 + 30 * Math.cos(rad)}
              y2={60 + 30 * Math.sin(rad)}
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}

        {/* Player 1 cursor */}
        <g style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>
          <polygon points="240,108 240,125 245,120 249,129 252,128 248,119 255,117" fill="#6366f1" />
          <rect x="237" y="130" width="28" height="14" rx="7" fill="#6366f1" />
          <text x="251" y="140" textAnchor="middle" fontSize="7" fill="white" fontFamily="sans-serif" fontWeight="bold">P1</text>
        </g>

        {/* Player 2 cursor */}
        <g style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>
          <polygon points="378,158 378,175 383,170 387,179 390,178 386,169 393,167" fill="#22c55e" />
          <rect x="375" y="180" width="28" height="14" rx="7" fill="#22c55e" />
          <text x="389" y="190" textAnchor="middle" fontSize="7" fill="white" fontFamily="sans-serif" fontWeight="bold">P2</text>
        </g>
      </svg>

      {/* Toolbar bottom */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          background: "#f8fafc",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        {["#0f172a", "#6366f1", "#22c55e", "#f59e0b", "#ef4444"].map((c, i) => (
          <span
            key={i}
            style={{
              width: i === 0 ? 20 : 16,
              height: i === 0 ? 20 : 16,
              borderRadius: "50%",
              background: c,
              display: "inline-block",
              border: i === 2 ? "2px solid #6366f1" : "2px solid transparent",
              cursor: "pointer",
            }}
          />
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
          🖊 Brush size: 4px
        </span>
      </div>
    </div>
  );
}

// ── How It Works Step Card ───────────────────────────────────────────────────

function StepCard({
  icon,
  step,
  title,
  desc,
  delay,
}: {
  icon: string;
  step: string;
  title: string;
  desc: string;
  delay: string;
}) {
  return (
    <div
      className={`card animate-fade-in-up ${delay}`}
      style={{ textAlign: "center", opacity: 0 }}
    >
      <div
        style={{
          fontSize: "2.5rem",
          marginBottom: "1rem",
          display: "inline-block",
        }}
      >
        {icon}
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ede9fe, #e0f2fe)",
          color: "#6366f1",
          fontWeight: 800,
          fontSize: "0.75rem",
          letterSpacing: 1.5,
          borderRadius: 9999,
          padding: "2px 12px",
          marginBottom: "0.75rem",
          textTransform: "uppercase",
          fontFamily: "var(--font-nunito), Nunito, sans-serif",
        }}
      >
        Step {step}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-nunito), Nunito, sans-serif",
          fontWeight: 800,
          fontSize: "1.2rem",
          color: "#0f172a",
          marginBottom: "0.5rem",
        }}
      >
        {title}
      </h3>
      <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6 }}>
        {desc}
      </p>
    </div>
  );
}

// ── Feature Badge ─────────────────────────────────────────────────────────────

function FeatureBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        background: "white",
        border: "1.5px solid #e2e8f0",
        borderRadius: 9999,
        padding: "0.5rem 1.25rem",
        fontSize: "0.9rem",
        fontWeight: 600,
        color: "#334155",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#a5b4fc";
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 4px 16px rgba(99,102,241,0.12)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#e2e8f0";
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 2px 8px rgba(0,0,0,0.04)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = () => {
    setLoading(true);
    // Generate a random 6-char room ID
    const roomId = Math.random().toString(36).substring(2, 8);
    setTimeout(() => {
      router.push(`/room/${roomId}`);
    }, 600);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* ── HEADER ── */}
      <header
        className="animate-fade-in-down"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          background: "rgba(248, 250, 252, 0.9)",
          borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0.9rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
          </div>

          {/* Tagline */}
          <span
            style={{
              fontSize: "0.82rem",
              color: "#94a3b8",
              fontWeight: 500,
              display: "none",
            }}
            className="hidden sm:block"
          >
            Real-time drawing with a friend
          </span>

          {/* CTA button (small) */}
          <button
            id="header-create-room-btn"
            className="btn-primary"
            style={{ padding: "0.55rem 1.4rem", fontSize: "0.9rem" }}
            onClick={handleCreateRoom}
            disabled={loading}
          >
            <span>🚀 Create Room</span>
          </button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "5rem 1.5rem 3rem",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "3.5rem",
          alignItems: "center",
        }}
      >
        {/* Left: text */}
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          {/* Badge */}
          <div
            className="animate-fade-in-up"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "linear-gradient(135deg, #ede9fe, #d1fae5)",
              borderRadius: 9999,
              padding: "6px 18px",
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#4f46e5",
              opacity: 0,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
              }}
            />
            No signup · No forms · Instant fun
          </div>

          {/* Headline */}
          <h1
            className="animate-fade-in-up delay-100"
            style={{
              fontFamily: "var(--font-nunito), Nunito, sans-serif",
              fontWeight: 900,
              fontSize: "clamp(2.4rem, 6vw, 3.8rem)",
              lineHeight: 1.15,
              color: "#0f172a",
              opacity: 0,
              maxWidth: 700,
            }}
          >
            Draw Together,{" "}
            <span className="gradient-text">In Real Time</span>
          </h1>

          {/* Sub */}
          <p
            className="animate-fade-in-up delay-200"
            style={{
              color: "#64748b",
              fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
              maxWidth: 520,
              lineHeight: 1.7,
              opacity: 0,
            }}
          >
            Create a room, share the link with a friend, and draw together on
            the same canvas — instantly, no login needed.
          </p>

          {/* CTA */}
          <div
            className="animate-fade-in-up delay-300"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              opacity: 0,
              width: "100%",
              maxWidth: 340,
            }}
          >
            <button
              id="hero-create-room-btn"
              className="btn-primary animate-pulse-glow"
              style={{ width: "100%", fontSize: "1.15rem", padding: "1.1rem 2rem" }}
              onClick={handleCreateRoom}
              disabled={loading}
            >
              <span>
                {loading ? (
                  <>
                    <span
                      style={{
                        display: "inline-block",
                        width: 16,
                        height: 16,
                        border: "2px solid rgba(255,255,255,0.4)",
                        borderTopColor: "white",
                        borderRadius: "50%",
                        animation: "spin-slow 0.6s linear infinite",
                        marginRight: 8,
                      }}
                    />
                    Creating Room…
                  </>
                ) : (
                  <>🎨 Create Room</>
                )}
              </span>
            </button>
            <span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>
              Room link generated in &lt;1 second
            </span>
          </div>

          {/* feature badges */}
          <div
            className="animate-fade-in-up delay-400"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.6rem",
              justifyContent: "center",
              opacity: 0,
            }}
          >
            <FeatureBadge icon="⚡" label="Real-time drawing" />
            <FeatureBadge icon="🔗" label="Shareable room link" />
            <FeatureBadge icon="⬇️" label="Download artwork" />
          </div>
        </div>

        {/* Canvas illustration */}
        <div
          className="animate-fade-in-up delay-500"
          style={{ opacity: 0, display: "flex", justifyContent: "center" }}
        >
          <CanvasIllustration />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        className="section"
        style={{
          background:
            "linear-gradient(180deg, var(--color-bg) 0%, #f0f4ff 100%)",
        }}
      >
        <p
          className="animate-fade-in-up"
          style={{
            textAlign: "center",
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: 2.5,
            color: "#6366f1",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
            opacity: 0,
            fontFamily: "var(--font-nunito), Nunito, sans-serif",
          }}
        >
          Simple by Design
        </p>
        <h2 className="section-title animate-fade-in-up delay-100" style={{ opacity: 0 }}>
          How It Works
        </h2>
        <p
          className="section-subtitle animate-fade-in-up delay-200"
          style={{ opacity: 0 }}
        >
          Three steps. That&apos;s it.
        </p>

        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.5rem",
          }}
        >
          <StepCard
            icon="🏠"
            step="1"
            title="Create a Room"
            desc="Click the button and a unique room is generated instantly. No account, no setup."
            delay="delay-200"
          />
          <StepCard
            icon="📨"
            step="2"
            title="Invite a Friend"
            desc="Copy your room link and send it — via WhatsApp, Discord, or any chat app."
            delay="delay-300"
          />
          <StepCard
            icon="✏️"
            step="3"
            title="Draw Together"
            desc="Both players see each other's strokes in real time on the same shared canvas."
            delay="delay-400"
          />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section
        className="section"
        style={{ background: "var(--color-surface)" }}
      >
        <h2
          className="section-title animate-fade-in-up"
          style={{ opacity: 0 }}
        >
          Everything You Need
        </h2>
        <p
          className="section-subtitle animate-fade-in-up delay-100"
          style={{ opacity: 0 }}
        >
          Simple tools for maximum creativity
        </p>

        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {[
            {
              icon: "⚡",
              title: "Real-Time Sync",
              desc: "WebSocket-powered drawing stays in perfect sync with latency under 200ms.",
              delay: "delay-200",
            },
            {
              icon: "🎨",
              title: "Simple Canvas Tools",
              desc: "Brush colors, sizes, and smooth strokes — everything you need, nothing you don't.",
              delay: "delay-300",
            },
            {
              icon: "⬇️",
              title: "Download Artwork",
              desc: "Save your masterpiece as a PNG file when you're done. Keep it, share it, frame it.",
              delay: "delay-400",
            },
          ].map((f) => (
            <div
              key={f.title}
              className={`card animate-fade-in-up ${f.delay}`}
              style={{ opacity: 0, display: "flex", gap: "1rem", alignItems: "flex-start" }}
            >
              <span
                style={{
                  fontSize: "1.8rem",
                  flexShrink: 0,
                  background: "linear-gradient(135deg, #ede9fe, #d1fae5)",
                  borderRadius: "0.75rem",
                  padding: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 52,
                  height: 52,
                }}
              >
                {f.icon}
              </span>
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-nunito), Nunito, sans-serif",
                    fontWeight: 800,
                    fontSize: "1.05rem",
                    color: "#0f172a",
                    marginBottom: "0.35rem",
                  }}
                >
                  {f.title}
                </h3>
                <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section
        className="section"
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #22c55e 100%)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2
            className="animate-fade-in-up"
            style={{
              fontFamily: "var(--font-nunito), Nunito, sans-serif",
              fontWeight: 900,
              fontSize: "clamp(1.8rem, 5vw, 2.8rem)",
              color: "white",
              marginBottom: "1rem",
              opacity: 0,
            }}
          >
            Ready to Draw? 🎉
          </h2>
          <p
            className="animate-fade-in-up delay-100"
            style={{
              color: "rgba(255,255,255,0.82)",
              fontSize: "1.1rem",
              marginBottom: "2rem",
              opacity: 0,
            }}
          >
            Your friend is waiting. Create a room and start drawing in seconds.
          </p>
          <button
            id="cta-create-room-btn"
            className="animate-fade-in-up delay-200"
            onClick={handleCreateRoom}
            disabled={loading}
            style={{
              opacity: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "white",
              color: "#6366f1",
              fontFamily: "var(--font-nunito), Nunito, sans-serif",
              fontWeight: 800,
              fontSize: "1.15rem",
              padding: "1rem 2.5rem",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              transition: "all 0.25s ease",
              boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(-3px) scale(1.04)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 14px 40px rgba(0,0,0,0.25)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "none";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 8px 30px rgba(0,0,0,0.15)";
            }}
          >
            🎨 Create Room — It&apos;s Free
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        style={{
          background: "#0f172a",
          color: "#94a3b8",
          textAlign: "center",
          padding: "2rem 1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.2rem" }}>🎨</span>
            <span
              style={{
                fontFamily: "var(--font-nunito), Nunito, sans-serif",
                fontWeight: 800,
                fontSize: "1rem",
                background: "linear-gradient(135deg, #a5b4fc, #6ee7b7)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              DrawTogether
            </span>
          </div>
          <p style={{ fontSize: "0.82rem" }}>
            © 2026 DrawTogether · Real-time collaborative drawing for everyone
          </p>
          <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.82rem" }}>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#64748b", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = "#a5b4fc")}
              onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = "#64748b")}
            >
              GitHub
            </a>
            <a
              href="#"
              style={{ color: "#64748b", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = "#a5b4fc")}
              onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = "#64748b")}
            >
              About
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
