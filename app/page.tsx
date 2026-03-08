"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function randomRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode Card
// ─────────────────────────────────────────────────────────────────────────────

function ModeCard({
  emoji,
  title,
  description,
  players,
  buttonLabel,
  accent,
  onAction,
  loading,
}: {
  emoji: string;
  title: string;
  description: string;
  players: string;
  buttonLabel: string;
  accent: string;
  onAction: () => void;
  loading: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        border: hovered ? `2px solid ${accent}` : "2px solid #e2e8f0",
        borderRadius: "1.5rem",
        padding: "2.25rem 2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        flex: "1 1 280px",
        minWidth: 0,
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-6px)" : "none",
        boxShadow: hovered
          ? `0 20px 45px rgba(0,0,0,0.10), 0 0 0 4px ${accent}22`
          : "0 4px 20px rgba(0,0,0,0.06)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft accent gradient at top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: accent,
          borderRadius: "9999px 9999px 0 0",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Emoji icon */}
      <div
        style={{
          fontSize: "2.8rem",
          lineHeight: 1,
          marginBottom: "0.25rem",
        }}
      >
        {emoji}
      </div>

      {/* Title */}
      <h3
        style={{
          fontFamily: "var(--font-nunito), Nunito, sans-serif",
          fontWeight: 900,
          fontSize: "1.25rem",
          color: "#0f172a",
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        style={{
          color: "#64748b",
          fontSize: "0.95rem",
          lineHeight: 1.65,
          flex: 1,
        }}
      >
        {description}
      </p>

      {/* Players badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: `${accent}18`,
          color: accent,
          borderRadius: 9999,
          padding: "4px 14px",
          fontSize: "0.8rem",
          fontWeight: 700,
          alignSelf: "flex-start",
        }}
      >
        👥 {players}
      </div>

      {/* Button */}
      <button
        id={`mode-btn-${title.replace(/\s+/g, "-").toLowerCase()}`}
        onClick={onAction}
        disabled={loading}
        style={{
          background: accent,
          color: "white",
          fontFamily: "var(--font-nunito), Nunito, sans-serif",
          fontWeight: 800,
          fontSize: "1rem",
          padding: "0.85rem 1.5rem",
          borderRadius: 9999,
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: `0 4px 16px ${accent}55`,
          opacity: loading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            (e.currentTarget as HTMLButtonElement).style.transform =
              "scale(1.04)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 28px ${accent}88`;
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "none";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 16px ${accent}55`;
        }}
      >
        {loading ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: 15,
                height: 15,
                border: "2px solid rgba(255,255,255,0.4)",
                borderTopColor: "white",
                borderRadius: "50%",
                animation: "spin-slow 0.6s linear infinite",
              }}
            />
            Creating…
          </>
        ) : (
          buttonLabel
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step card (How It Works)
// ─────────────────────────────────────────────────────────────────────────────

function StepCard({
  num,
  icon,
  title,
  desc,
}: {
  num: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1.5px solid #e2e8f0",
        borderRadius: "1.25rem",
        padding: "1.75rem 1.5rem",
        textAlign: "center",
        flex: "1 1 200px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
        transition: "all 0.25s ease",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 12px 32px rgba(99,102,241,0.1)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "#a5b4fc";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "none";
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 2px 12px rgba(0,0,0,0.04)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "#e2e8f0";
      }}
    >
      <div style={{ fontSize: "2.2rem" }}>{icon}</div>
      <div
        style={{
          background: "linear-gradient(135deg, #ede9fe, #d1fae5)",
          color: "#6366f1",
          fontWeight: 800,
          fontSize: "0.75rem",
          letterSpacing: 1.5,
          borderRadius: 9999,
          padding: "3px 14px",
          textTransform: "uppercase",
          fontFamily: "var(--font-nunito), Nunito, sans-serif",
        }}
      >
        Step {num}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-nunito), Nunito, sans-serif",
          fontWeight: 800,
          fontSize: "1.05rem",
          color: "#0f172a",
        }}
      >
        {title}
      </h3>
      <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.6 }}>
        {desc}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [colabLoading, setColabLoading] = useState(false);
  const [guessLoading, setGuessLoading] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const gameModesRef = useRef<HTMLElement>(null);

  const handleScrollToModes = () => {
    gameModesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCreateCollab = () => {
    setColabLoading(true);
    const id = randomRoomId();
    setTimeout(() => router.push(`/lobby/${id}?mode=collab`), 600);
  };

  const handleCreateGuess = () => {
    setGuessLoading(true);
    const id = randomRoomId();
    setTimeout(() => router.push(`/lobby/${id}?mode=guess`), 600);
  };

  const handleJoinRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setJoinError("Please enter a room code.");
      return;
    }
    if (code.length < 4) {
      setJoinError("Room code seems too short.");
      return;
    }
    router.push(`/room/${code}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* ═══════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════ */}
      <header
        className="animate-fade-in-down"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: "rgba(248, 250, 252, 0.92)",
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

          {/* Nav */}
          <a
            href="#how-it-works"
            style={{
              color: "#475569",
              fontWeight: 600,
              fontSize: "0.92rem",
              textDecoration: "none",
              padding: "0.4rem 1rem",
              borderRadius: 9999,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                "#ede9fe";
              (e.currentTarget as HTMLAnchorElement).style.color = "#6366f1";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background =
                "transparent";
              (e.currentTarget as HTMLAnchorElement).style.color = "#475569";
            }}
          >
            How It Works
          </a>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          textAlign: "center",
          padding: "5.5rem 1.5rem 4rem",
          maxWidth: 780,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
        }}
      >
        {/* Live badge */}
        <div
          className="animate-fade-in-up"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
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
              animation: "pulse-glow 1.5s ease-in-out infinite",
              boxShadow: "0 0 0 0 rgba(34,197,94,0.4)",
            }}
          />
          No signup · No login · Instant fun
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
          }}
        >
          🎨 DrawTogether
        </h1>

        {/* Subtitle */}
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
          Draw with friends or guess the drawing in a fast multiplayer game.
          Zero setup — just create a room and share the link.
        </p>

        {/* CTA */}
        <div
          className="animate-fade-in-up delay-300"
          style={{ opacity: 0 }}
        >
          <button
            id="hero-start-playing-btn"
            className="btn-primary animate-pulse-glow"
            style={{ fontSize: "1.15rem", padding: "1.1rem 2.5rem" }}
            onClick={handleScrollToModes}
          >
            <span>✏️ Start Playing</span>
          </button>
        </div>

        {/* Mini feature pills */}
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
          {[
            ["⚡", "Real-time drawing"],
            ["🔗", "Shareable room link"],
            ["🏆", "Score & compete"],
            ["⬇️", "Download artwork"],
          ].map(([icon, label]) => (
            <span
              key={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "white",
                border: "1.5px solid #e2e8f0",
                borderRadius: 9999,
                padding: "0.45rem 1.1rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#334155",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              {icon} {label}
            </span>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          GAME MODE SELECTION
      ═══════════════════════════════════════════════════════════════ */}
      <section
        id="game-modes"
        ref={gameModesRef}
        style={{
          background: "linear-gradient(180deg, #f8fafc 0%, #f0f4ff 100%)",
          padding: "4rem 1.5rem 5rem",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          {/* Section heading */}
          <p
            className="animate-fade-in-up"
            style={{
              textAlign: "center",
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: 2.5,
              color: "#6366f1",
              textTransform: "uppercase",
              marginBottom: "0.4rem",
              opacity: 0,
              fontFamily: "var(--font-nunito), Nunito, sans-serif",
            }}
          >
            Pick your style
          </p>
          <h2
            className="section-title animate-fade-in-up delay-100"
            style={{ opacity: 0, marginBottom: "0.5rem" }}
          >
            Choose Game Mode
          </h2>
          <p
            className="section-subtitle animate-fade-in-up delay-200"
            style={{ opacity: 0, marginBottom: "2.5rem" }}
          >
            Two ways to play. Both are free.
          </p>

          {/* Cards */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1.5rem",
              justifyContent: "center",
            }}
          >
            <ModeCard
              emoji="🎨"
              title="Collaborative Drawing"
              description="Two players share the same canvas and draw together in real time. Create funny drawings, experiment together, and download your masterpiece."
              players="Players: 2"
              buttonLabel="🎨 Create Room"
              accent="#6366f1"
              onAction={handleCreateCollab}
              loading={colabLoading}
            />
            <ModeCard
              emoji="🧠"
              title="Guess The Drawing"
              description="One player draws a secret word while others race to guess it. Score points for correct guesses and see who wins after several rounds."
              players="Players: 2 – 6"
              buttonLabel="🧠 Create Game Room"
              accent="#f59e0b"
              onAction={handleCreateGuess}
              loading={guessLoading}
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="section"
        style={{ background: "white" }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p
            className="animate-fade-in-up"
            style={{
              textAlign: "center",
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: 2.5,
              color: "#6366f1",
              textTransform: "uppercase",
              marginBottom: "0.4rem",
              opacity: 0,
              fontFamily: "var(--font-nunito), Nunito, sans-serif",
            }}
          >
            Simple by design
          </p>
          <h2
            className="section-title animate-fade-in-up delay-100"
            style={{ opacity: 0, marginBottom: "0.5rem" }}
          >
            How It Works
          </h2>
          <p
            className="section-subtitle animate-fade-in-up delay-200"
            style={{ opacity: 0, marginBottom: "2.5rem" }}
          >
            Three steps — that&apos;s it.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1.25rem",
              justifyContent: "center",
            }}
          >
            <StepCard
              num="1"
              icon="1️⃣"
              title="Create a Room"
              desc="Pick a game mode, click the button, and a unique room is created instantly. No account or setup needed."
            />
            <StepCard
              num="2"
              icon="2️⃣"
              title="Share the Link"
              desc="Copy your room link and send it to friends via WhatsApp, Discord, or any chat app."
            />
            <StepCard
              num="3"
              icon="3️⃣"
              title="Draw & Guess!"
              desc="Start drawing together or race to guess the word. Score points and see who wins!"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          JOIN ROOM
      ═══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #7c3aed 100%)",
          padding: "4.5rem 1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <h2
            className="animate-fade-in-up"
            style={{
              fontFamily: "var(--font-nunito), Nunito, sans-serif",
              fontWeight: 900,
              fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
              color: "white",
              marginBottom: "0.6rem",
              opacity: 0,
            }}
          >
            Join a Room 🔗
          </h2>
          <p
            className="animate-fade-in-up delay-100"
            style={{
              color: "rgba(255,255,255,0.8)",
              fontSize: "1rem",
              marginBottom: "2rem",
              opacity: 0,
            }}
          >
            Got a room code from a friend? Enter it below.
          </p>

          <div
            className="animate-fade-in-up delay-200"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              alignItems: "center",
              opacity: 0,
            }}
          >
            <input
              id="room-code-input"
              type="text"
              placeholder="Enter Room Code  e.g. AB12CD"
              value={roomCode}
              maxLength={10}
              onChange={(e) => {
                setRoomCode(e.target.value.toUpperCase());
                setJoinError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
              style={{
                width: "100%",
                maxWidth: 360,
                padding: "0.95rem 1.4rem",
                borderRadius: 9999,
                border: joinError
                  ? "2px solid #fca5a5"
                  : "2px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.12)",
                color: "white",
                fontSize: "1.05rem",
                fontWeight: 700,
                fontFamily: "var(--font-nunito), Nunito, sans-serif",
                letterSpacing: 2,
                outline: "none",
                textAlign: "center",
                backdropFilter: "blur(8px)",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor =
                  "rgba(255,255,255,0.7)";
                (e.currentTarget as HTMLInputElement).style.background =
                  "rgba(255,255,255,0.18)";
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = joinError
                  ? "#fca5a5"
                  : "rgba(255,255,255,0.3)";
                (e.currentTarget as HTMLInputElement).style.background =
                  "rgba(255,255,255,0.12)";
              }}
            />
            {joinError && (
              <p
                style={{
                  color: "#fca5a5",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginTop: -4,
                }}
              >
                {joinError}
              </p>
            )}
            <button
              id="join-room-btn"
              onClick={handleJoinRoom}
              style={{
                background: "white",
                color: "#6366f1",
                fontFamily: "var(--font-nunito), Nunito, sans-serif",
                fontWeight: 900,
                fontSize: "1.05rem",
                padding: "0.95rem 2.5rem",
                borderRadius: 9999,
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(-3px) scale(1.04)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 12px 36px rgba(0,0,0,0.28)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "none";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 6px 24px rgba(0,0,0,0.18)";
              }}
            >
              🚀 Join Room
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════ */}
      <footer
        style={{
          background: "#0f172a",
          color: "#94a3b8",
          textAlign: "center",
          padding: "2.25rem 1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 600,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.3rem" }}>🎨</span>
            <span
              style={{
                fontFamily: "var(--font-nunito), Nunito, sans-serif",
                fontWeight: 900,
                fontSize: "1.05rem",
                background: "linear-gradient(135deg, #a5b4fc, #6ee7b7)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              DrawTogether
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
            A simple multiplayer drawing game. 🖌️ No login needed.
          </p>
          <p style={{ fontSize: "0.78rem", color: "#475569" }}>
            © 2026 DrawTogether
          </p>
        </div>
      </footer>
    </div>
  );
}
