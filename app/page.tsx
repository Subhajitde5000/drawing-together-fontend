"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Link from "next/link";

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
        background: hovered ? `${accent}0d` : "#fffff5",
        border: hovered ? `3px solid ${accent}` : "3px solid #1a1a1a",
        borderRadius: "8px 18px 12px 22px / 18px 8px 22px 12px",
        padding: "2.25rem 2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        flex: "1 1 280px",
        minWidth: 0,
        transition: "all 0.15s ease",
        transform: hovered ? "translateY(-6px) rotate(-1deg)" : "rotate(0.4deg)",
        boxShadow: hovered ? `6px 6px 0 ${accent}` : "5px 5px 0 #1a1a1a",
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
          fontFamily: "var(--font-nunito), Caveat, cursive",
          fontWeight: 700,
          fontSize: "1.3rem",
          color: "#1a1a1a",
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        style={{
          color: "#525252",
          fontSize: "0.98rem",
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
          background: `${accent}15`,
          color: accent,
          border: `2px solid ${accent}`,
          borderRadius: "4px 10px 6px 12px / 10px 4px 12px 6px",
          padding: "4px 14px",
          fontSize: "0.88rem",
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
          fontFamily: "var(--font-nunito), Caveat, cursive",
          fontWeight: 700,
          fontSize: "1rem",
          padding: "0.85rem 1.5rem",
          borderRadius: "255px 15px 225px 15px / 15px 225px 15px 255px",
          border: "3px solid #1a1a1a",
          cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: "3px 3px 0 #1a1a1a",
          opacity: loading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            (e.currentTarget as HTMLButtonElement).style.transform =
              "translateY(-2px) rotate(-1deg)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "5px 5px 0 #1a1a1a";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "none";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "3px 3px 0 #1a1a1a";
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
        background: "#fffff5",
        border: "3px solid #1a1a1a",
        borderRadius: "8px 16px 12px 20px / 16px 8px 20px 12px",
        padding: "1.75rem 1.5rem",
        textAlign: "center",
        flex: "1 1 200px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
        transition: "all 0.15s ease",
        boxShadow: "5px 5px 0 #1a1a1a",
        transform: "rotate(-0.5deg)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-5px) rotate(-1.5deg)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "7px 7px 0 #4338ca";
        (e.currentTarget as HTMLDivElement).style.borderColor = "#4338ca";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "rotate(-0.5deg)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "5px 5px 0 #1a1a1a";
        (e.currentTarget as HTMLDivElement).style.borderColor = "#1a1a1a";
      }}
    >
      <div style={{ fontSize: "2.2rem" }}>{icon}</div>
      <div
        style={{
          background: "#fef08a",
          color: "#1a1a1a",
          fontWeight: 700,
          fontSize: "0.85rem",
          letterSpacing: 1,
          border: "2px solid #1a1a1a",
          borderRadius: "4px 8px 6px 10px / 8px 4px 10px 6px",
          padding: "3px 14px",
          textTransform: "uppercase",
          fontFamily: "var(--font-nunito), Caveat, cursive",
          boxShadow: "2px 2px 0 #1a1a1a",
        }}
      >
        Step {num}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-nunito), Caveat, cursive",
          fontWeight: 700,
          fontSize: "1.1rem",
          color: "#1a1a1a",
        }}
      >
        {title}
      </h3>
      <p style={{ color: "#525252", fontSize: "0.95rem", lineHeight: 1.6 }}>
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
  const [showMoreFun, setShowMoreFun] = useState(false);
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
    <div style={{ minHeight: "100vh", background: "#fffef0", backgroundImage: "linear-gradient(rgba(99,102,241,0.07) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(99,102,241,0.07) 1.5px, transparent 1.5px)", backgroundSize: "32px 32px" }}>
      {/* ═══════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════ */}
      <header
        className="animate-fade-in-down"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,254,240,0.97)",
          borderBottom: "3px solid #1a1a1a",
          boxShadow: "0 3px 0 0 #1a1a1a",
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
                fontFamily: "var(--font-nunito), Caveat, cursive",
                fontWeight: 900,
                fontSize: "1.3rem",
                background: "linear-gradient(135deg, #4338ca, #16a34a)",
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
                "#fef08a";
              (e.currentTarget as HTMLAnchorElement).style.color = "#1a1a1a";
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
            background: "#fef08a",
            border: "2.5px solid #1a1a1a",
            borderRadius: "6px 14px 8px 16px / 14px 6px 16px 8px",
            padding: "6px 18px",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "#1a1a1a",
            opacity: 0,
            boxShadow: "3px 3px 0 #1a1a1a",
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
            fontFamily: "var(--font-nunito), Caveat, cursive",
            fontWeight: 900,
            fontSize: "clamp(2.4rem, 6vw, 3.8rem)",
            lineHeight: 1.15,
            color: "#1a1a1a",
            opacity: 0,
          }}
        >
          🎨 DrawTogether
        </h1>

        {/* Doodle underline */}
        <svg
          className="animate-fade-in-up delay-150"
          style={{ opacity: 0, marginTop: "-0.5rem" }}
          width="260" height="16" viewBox="0 0 260 16"
        >
          <path
            d="M3,12 C38,4 75,14 112,8 C149,2 196,15 257,7"
            stroke="#6366f1" strokeWidth="3.5" fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: 280,
              strokeDashoffset: 280,
              animation: "draw-line 1.1s 0.6s ease forwards",
            }}
          />
        </svg>

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
                border: "2.5px solid #1a1a1a",
                borderRadius: "4px 10px 6px 12px / 10px 4px 12px 6px",
                padding: "0.45rem 1.1rem",
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#1a1a1a",
                boxShadow: "2px 2px 0 #1a1a1a",
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
          background: "#fffce8",
          padding: "4rem 1.5rem 5rem",
          borderTop: "3px solid #1a1a1a",
          borderBottom: "3px solid #1a1a1a",
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
              fontFamily: "var(--font-nunito), Caveat, cursive",
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

          <div style={{ marginTop: "4rem", display: "flex", justifyContent: "center" }}>
            <button
              onClick={() => setShowMoreFun(true)}
              style={{
                background: "linear-gradient(135deg, #f43f5e, #ec4899)",
                color: "white",
                fontFamily: "var(--font-nunito), Caveat, cursive",
                fontWeight: 800,
                fontSize: "1.2rem",
                padding: "1rem 2.5rem",
                borderRadius: "255px 15px 225px 15px / 15px 225px 15px 255px",
                border: "3px solid #1a1a1a",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: "4px 4px 0 #1a1a1a",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px) rotate(-2deg)";
                e.currentTarget.style.boxShadow = "6px 6px 0 #1a1a1a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "4px 4px 0 #1a1a1a";
              }}
            >
              🎉 More Fun Games
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="section"
        style={{ background: "#f0f9ff" }}
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
              fontFamily: "var(--font-nunito), Caveat, cursive",
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
          background: "#312e81",
          padding: "4.5rem 1.5rem",
          textAlign: "center",
          borderTop: "4px solid #1a1a1a",
          borderBottom: "4px solid #1a1a1a",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <h2
            className="animate-fade-in-up"
            style={{
              fontFamily: "var(--font-nunito), Caveat, cursive",
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
                borderRadius: "6px 14px 8px 16px / 14px 6px 16px 8px",
                border: joinError
                  ? "3px solid #fca5a5"
                  : "3px solid rgba(255,255,255,0.7)",
                background: "rgba(255,255,255,0.1)",
                color: "white",
                fontSize: "1.1rem",
                fontWeight: 700,
                fontFamily: "var(--font-nunito), Caveat, cursive",
                letterSpacing: 2,
                outline: "none",
                textAlign: "center",
                transition: "border-color 0.2s ease",
                boxShadow: "3px 3px 0 rgba(255,255,255,0.15)",
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
                color: "#312e81",
                fontFamily: "var(--font-nunito), Caveat, cursive",
                fontWeight: 700,
                fontSize: "1.1rem",
                padding: "0.95rem 2.5rem",
                borderRadius: "255px 15px 225px 15px / 15px 225px 15px 255px",
                border: "3px solid #1a1a1a",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: "4px 4px 0 #1a1a1a",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform =
                  "translateY(-3px) rotate(-1deg)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "6px 6px 0 #1a1a1a";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "none";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "4px 4px 0 #1a1a1a";
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
          background: "#1a1a1a",
          color: "#d4d4d4",
          textAlign: "center",
          padding: "2.25rem 1.5rem",
          borderTop: "4px solid #333",
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
                fontFamily: "var(--font-nunito), Caveat, cursive",
                fontWeight: 900,
                fontSize: "1.05rem",
                background: "linear-gradient(135deg, #818cf8, #4ade80)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              DrawTogether
            </span>
          </div>
          <p style={{ fontSize: "1rem", color: "#a3a3a3" }}>
            A simple multiplayer drawing game. 🖌️ No login needed.
          </p>
          <p style={{ fontSize: "0.9rem", color: "#737373" }}>
            © 2026 DrawTogether
          </p>
        </div>
      </footer>

      {/* More Fun Modal */}
      {showMoreFun && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem"
        }}>
          <div className="animate-fade-in-up" style={{
            background: "#fff",
            border: "4px solid #1a1a1a",
            borderRadius: "16px",
            padding: "2.5rem 2rem",
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            boxShadow: "10px 10px 0 rgba(0,0,0,0.3)",
            position: "relative"
          }}>
            <button 
              onClick={() => setShowMoreFun(false)}
              style={{
                position: "absolute",
                top: 15,
                right: 20,
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#666",
                padding: "4px",
              }}
            >
              ✕
            </button>
            <h2 style={{
              fontFamily: "var(--font-nunito), Caveat, cursive",
              fontSize: "2.2rem",
              fontWeight: 900,
              color: "#1a1a1a",
              marginBottom: "0.5rem"
            }}>
              More Games! 🎮
            </h2>
            <p style={{ color: "#525252", marginBottom: "2rem", lineHeight: 1.6, fontSize: "1.05rem" }}>
              Try our brand new stealth action game mode! Hide, escape, and outsmart your friends.
            </p>
            <Link href="/police-thieves">
              <button style={{
                background: "#0f172a",
                color: "#fbbf24",
                fontFamily: "var(--font-nunito), Caveat, cursive",
                fontWeight: 800,
                fontSize: "1.3rem",
                padding: "1.2rem 2rem",
                borderRadius: "12px",
                border: "4px solid #1a1a1a",
                cursor: "pointer",
                width: "100%",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                boxShadow: "4px 4px 0 #1a1a1a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "6px 6px 0 #1a1a1a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "4px 4px 0 #1a1a1a";
              }}
              onClick={() => setShowMoreFun(false)}
              >
                🚓 Play Police vs Thieves 🕵️
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
