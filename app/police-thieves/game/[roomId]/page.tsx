"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const ThreeGame = dynamic(() => import("./ThreeGame"), { ssr: false });

interface OtherPlayer {
  id: string;
  name: string;
  role: string;
  x: number;
  z: number;
  rotY: number;
  alive: boolean;
}

interface ScoreEntry { id: string; name: string; score: number; }

interface RoundOver {
  winner: string;
  reason: string;
  round: number;
  total_rounds: number;
  scores: ScoreEntry[];
  more_rounds: boolean;
  next_in: number;
}

interface GameOver {
  winner: string;
  reason: string;
  final: boolean;
  scores: ScoreEntry[];
}

interface RemoteHint {
  playerId: string;
  name: string;
  x: number;
  z: number;
}

export default function PoliceThievesGame() {
  const params = useParams();
  const router = useRouter();
  const rawRoomId = params.roomId;
  const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;
  const normalizedRoomId = roomId?.toUpperCase() || "";

  const wsRef        = useRef<WebSocket | null>(null);
  const myPlayerIdRef = useRef<string>("");
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const [myRole, setMyRole]           = useState<"police" | "thief">("thief");
  const [myAlive, setMyAlive]         = useState(true);
  const [phase, setPhase]             = useState("lobby");
  const [timeLeft, setTimeLeft]       = useState(120);
  const [noLimitMode, setNoLimitMode] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds]   = useState(1);
  const [otherPlayers, setOtherPlayers] = useState<OtherPlayer[]>([]);
  const [roundOver, setRoundOver]     = useState<RoundOver | null>(null);
  const [nextRoundIn, setNextRoundIn] = useState(0);
  const [gameOver, setGameOver]       = useState<GameOver | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connected, setConnected]     = useState(false);
  const [roleReveal, setRoleReveal]   = useState(false);
  const [redirectCount, setRedirectCount] = useState(5);
  const [remoteHints, setRemoteHints] = useState<RemoteHint[]>([]);
  const hintTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Track other players by id in a ref for fast updates from WS
  const otherPlayersRef = useRef<Map<string, OtherPlayer>>(new Map());
  const prevPhaseRef    = useRef("lobby");

  const thievesLeft = otherPlayers.filter(p => p.role === "thief" && p.alive).length;
  const totalPlayers = otherPlayers.length + 1;
  const playersAlive = otherPlayers.filter(p => p.alive).length + 1;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  // Send position update to server (called by ThreeGame)
  const handlePositionUpdate = useCallback((x: number, z: number, rotY: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "position_update", x, z, rotY }));
    }
  }, []);

  // Called by ThreeGame when thief activates hint — send to server
  const handleHintActivated = useCallback((x: number, z: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "hint", x, z }));
    }
  }, []);

  useEffect(() => {
    if (!normalizedRoomId) return;
    unmountedRef.current = false;

    const name = localStorage.getItem("police-thieves-player-name") || "Player";
    let pid = localStorage.getItem(`pt-pid-${normalizedRoomId}`);
    if (!pid) {
      pid = crypto.randomUUID();
      localStorage.setItem(`pt-pid-${normalizedRoomId}`, pid);
    }
    myPlayerIdRef.current = pid;

    const base = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000").replace(/\/$/, "");

    function connect() {
      if (unmountedRef.current) return;
      const ws = new WebSocket(`${base}/police-thieves/ws/${normalizedRoomId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: "join", player_id: pid, name }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);

        if (msg.type === "state") {
          const newPhase = msg.phase;
          setPhase(newPhase);
          setTimeLeft(msg.time_left ?? 120);
          if (msg.settings?.round_time === 0) setNoLimitMode(true);
          if (msg.settings?.current_round) setCurrentRound(msg.settings.current_round);
          if (msg.settings?.total_rounds)  setTotalRounds(msg.settings.total_rounds);
          // Find my role from players list
          const me = (msg.players ?? []).find((p: {id: string}) => p.id === myPlayerIdRef.current);
          if (me?.role) setMyRole(me.role as "police" | "thief");
          if (me?.alive !== undefined) setMyAlive(me.alive as boolean);
          // Show role reveal banner when game first starts (lobby → hiding)
          if (prevPhaseRef.current === "lobby" && newPhase === "hiding") {
            setRoleReveal(true);
            setTimeout(() => setRoleReveal(false), 3500);
          }
          prevPhaseRef.current = newPhase;
          // Build other players list
          const others: OtherPlayer[] = (msg.players ?? [])
            .filter((p: {id: string}) => p.id !== myPlayerIdRef.current)
            .map((p: {id: string; name: string; role: string; raw_x?: number; raw_z?: number; raw_rot?: number; alive: boolean}) => ({
              id: p.id, name: p.name, role: p.role ?? "thief",
              x: p.raw_x ?? 0, z: p.raw_z ?? 0, rotY: p.raw_rot ?? 0, alive: p.alive,
            }));
          others.forEach(p => otherPlayersRef.current.set(p.id, p));
          setOtherPlayers([...otherPlayersRef.current.values()]);
        }

        else if (msg.type === "player_moved") {
          if (msg.player_id === myPlayerIdRef.current) return;
          const existing = otherPlayersRef.current.get(msg.player_id);
          if (existing) {
            existing.x = msg.x; existing.z = msg.z; existing.rotY = msg.rotY; existing.alive = msg.alive;
            setOtherPlayers([...otherPlayersRef.current.values()]);
          }
        }

        else if (msg.type === "positions") {
          for (const p of msg.players ?? []) {
            if (p.id === myPlayerIdRef.current) continue;
            const existing = otherPlayersRef.current.get(p.id);
            if (existing) { existing.x = p.x; existing.z = p.z; existing.rotY = p.rotY ?? 0; existing.alive = p.alive; }
          }
          setOtherPlayers([...otherPlayersRef.current.values()]);
        }

        else if (msg.type === "timer") {
          setTimeLeft(msg.seconds);
          setPhase(msg.phase);
        }

        else if (msg.type === "round_over") {
          setRoundOver(msg as RoundOver);
          setNextRoundIn(msg.next_in);
          setPhase("ended");
        }

        else if (msg.type === "next_round_countdown") {
          setNextRoundIn(msg.seconds);
          // When countdown hits 0 the server auto-starts next round; clear overlay
          if (msg.seconds === 0) {
            setRoundOver(null);
            setMyAlive(true);
          }
        }

        else if (msg.type === "game_over") {
          setGameOver({ winner: msg.winner, reason: msg.reason, final: msg.final ?? true, scores: msg.scores ?? [] });
          setPhase("ended");
        }

        else if (msg.type === "player_left") {
          otherPlayersRef.current.delete(msg.player_id);
          setOtherPlayers([...otherPlayersRef.current.values()]);
        }

        else if (msg.type === "hint") {
          // Show hint beacon from a thief — expires after 10 seconds
          const { player_id, name, x, z } = msg;
          setRemoteHints(prev => {
            const filtered = prev.filter(h => h.playerId !== player_id);
            return [...filtered, { playerId: player_id, name, x, z }];
          });
          // Clear after 10s
          const existing = hintTimersRef.current.get(player_id);
          if (existing) clearTimeout(existing);
          const t = setTimeout(() => {
            setRemoteHints(prev => prev.filter(h => h.playerId !== player_id));
            hintTimersRef.current.delete(player_id);
          }, 10000);
          hintTimersRef.current.set(player_id, t);
        }

        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setConnected(false);
        // Auto-reconnect after 2 seconds (unless page is unmounted)
        if (!unmountedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [normalizedRoomId]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Auto-redirect to lobby only after the FINAL game over (all rounds done)
  useEffect(() => {
    if (!gameOver) return;
    setRedirectCount(8);
    let count = 8;
    const interval = setInterval(() => {
      count -= 1;
      setRedirectCount(count);
      if (count <= 0) {
        clearInterval(interval);
        router.push(`/police-thieves/lobby/${normalizedRoomId}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [gameOver, normalizedRoomId, router]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else if (document.exitFullscreen) await document.exitFullscreen();
    } catch { /* ignore */ }
  };


  return (
    <>
      <style>{`
        @media screen and (orientation: portrait) and (max-width: 1024px) {
          .auto-landscape {
            transform: rotate(90deg); transform-origin: left top;
            width: 100vh !important; height: 100vw !important;
            position: absolute; top: 0; left: 100%;
          }
        }
      `}</style>
      <div className="absolute inset-0 bg-slate-50 text-slate-800 flex flex-col font-sans overflow-hidden select-none auto-landscape">
        
        {/* Top HUD */}
        <div className="h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 flex justify-between items-center shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
            <Link href={`/police-thieves/lobby/${normalizedRoomId}`} className="text-slate-400 hover:text-slate-600 transition-colors">
              <span className="text-xl">⏴</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-sm uppercase tracking-widest text-slate-400 font-bold hidden sm:inline-block">Role:</span>
              {myRole === "police" ? (
                <span className="bg-blue-50 border border-blue-200 text-blue-600 px-4 py-1.5 rounded-lg font-black tracking-wide shadow-sm flex items-center gap-2">🚓 Police</span>
              ) : (
                <span className="bg-red-50 border border-red-200 text-red-600 px-4 py-1.5 rounded-lg font-black tracking-wide shadow-sm flex items-center gap-2">🕵️ Thief</span>
              )}
            </div>
            {/* Phase badge */}
            {phase === "hiding" && (
              <span className="bg-orange-100 border border-orange-200 text-orange-600 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider">
                {myRole === "thief" ? "🏃 Hide!" : "🙈 Eyes Closed"}
              </span>
            )}
            {/* Round indicator (only show if multi-round) */}
            {totalRounds > 1 && (
              <span className="bg-indigo-50 border border-indigo-200 text-indigo-600 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider hidden sm:inline-block">
                R{currentRound}/{totalRounds}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4 mx-2">
            <span className="bg-slate-50 border border-slate-200 px-2 sm:px-4 py-1.5 rounded-lg flex items-center gap-1 sm:gap-2 shadow-sm whitespace-nowrap">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] sm:text-xs hidden md:inline-block">Thieves:</span>
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] sm:text-xs md:hidden">T:</span>
              <span className="text-red-500 font-black text-sm sm:text-base">{thievesLeft}</span>
            </span>
            <span className="bg-slate-50 border border-slate-200 px-2 sm:px-4 py-1.5 rounded-lg flex items-center gap-1 sm:gap-2 shadow-sm whitespace-nowrap">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] sm:text-xs hidden md:inline-block">Players:</span>
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] sm:text-xs md:hidden">P:</span>
              <span className="text-indigo-600 font-black text-sm sm:text-base">{playersAlive} <span className="text-slate-400 font-normal text-[10px] sm:text-xs">/ {totalPlayers}</span></span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm uppercase tracking-widest text-slate-400 font-bold hidden sm:inline-block">Time:</span>
            <span className={`border font-mono text-xl font-bold px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-2 ${!noLimitMode && phase === "active" && timeLeft < 10 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
              {phase === "active" && noLimitMode ? "⏱ ∞" : `⏱ ${formatTime(timeLeft)}`}
            </span>
            <button onClick={toggleFullscreen} className="ml-2 w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg border border-slate-200 transition-colors shadow-sm" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
              <span className="text-lg">{isFullscreen ? "⛌" : "⛶"}</span>
            </button>
          </div>
        </div>

        {/* Game Canvas */}
        <div className="flex-1 relative overflow-hidden bg-slate-900">
          <ThreeGame
            role={myRole}
            phase={phase}
            myAlive={myAlive}
            otherPlayers={otherPlayers}
            onPositionUpdate={handlePositionUpdate}
            onHintActivated={handleHintActivated}
            remoteHints={remoteHints}
          />
        </div>

        {/* Hint notification toasts — shown to all when a thief sends a hint */}
        {remoteHints.length > 0 && (
          <div className="absolute top-20 right-4 z-40 flex flex-col gap-2 pointer-events-none">
            {remoteHints.map(h => (
              <div key={h.playerId} className="bg-orange-500/95 text-white px-4 py-2 rounded-xl font-bold shadow-xl flex items-center gap-2 text-sm">
                <span>🔔</span>
                <span><strong>{h.name}</strong> sent a hint!</span>
              </div>
            ))}
          </div>
        )}

        {/* Spectator overlay — shown when thief is caught (Rule 8) */}
        {myRole === "thief" && !myAlive && phase === "active" && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <div className="bg-slate-800/90 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-2">
              <span>👁️</span> You were caught — spectating
            </div>
          </div>
        )}

        {/* Role reveal overlay — shown for 3.5s at game start */}
        {roleReveal && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className={`px-10 py-8 rounded-3xl shadow-2xl text-center border-4 animate-bounce ${myRole === "police" ? "bg-blue-600/95 border-blue-300 text-white" : "bg-red-600/95 border-red-300 text-white"}`}>
              <div className="text-6xl mb-3">{myRole === "police" ? "🚓" : "🕵️"}</div>
              <p className="text-sm font-black uppercase tracking-widest opacity-80 mb-1">You are</p>
              <p className="text-4xl font-black uppercase tracking-wider">{myRole === "police" ? "Police" : "Thief"}</p>
              <p className="mt-3 text-sm font-semibold opacity-80">
                {myRole === "police" ? "Wait 30s, then hunt the thieves!" : "Hide now! You have 30 seconds!"}
              </p>
            </div>
          </div>
        )}

        {/* Round-over scoreboard — shown between rounds, auto-clears when next round starts */}
        {roundOver && !gameOver && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-auto overflow-hidden">
              {/* Header */}
              <div className={`px-8 pt-8 pb-5 text-center ${roundOver.winner === "police" ? "bg-blue-500" : "bg-red-500"}`}>
                <div className="text-5xl mb-2">{roundOver.winner === "police" ? "🚓" : "🕵️"}</div>
                <h2 className="text-2xl font-black text-white">{roundOver.winner === "police" ? "Police Win!" : "Thieves Win!"}</h2>
                <p className="text-white/80 text-sm font-semibold mt-1">
                  Round {roundOver.round} / {roundOver.total_rounds} ·{" "}
                  {roundOver.reason === "all_caught" ? "All thieves caught" :
                   roundOver.reason === "police_caught" ? "Police caught!" : "Time ran out"}
                </p>
              </div>
              {/* Scores */}
              <div className="px-6 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Scoreboard</p>
                <ul className="space-y-2">
                  {roundOver.scores.map((s, i) => (
                    <li key={s.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                      <span className="flex items-center gap-2 font-bold text-slate-700">
                        <span className="text-slate-400 font-mono text-sm w-5">{i + 1}.</span>
                        {i === 0 && <span>🥇</span>}
                        {i === 1 && <span>🥈</span>}
                        {i === 2 && <span>🥉</span>}
                        {s.name}
                      </span>
                      <span className="font-black text-indigo-600 text-lg">{s.score} <span className="text-xs font-semibold text-slate-400">pts</span></span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Next round countdown */}
              <div className="px-6 pb-6 text-center">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl py-3 px-4">
                  <p className="text-amber-700 font-black text-lg">
                    Next round in <span className="text-3xl">{nextRoundIn}</span>s…
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Final game-over scoreboard — shown after all rounds */}
        {gameOver && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-auto overflow-hidden">
              {/* Header */}
              <div className={`px-8 pt-8 pb-5 text-center ${gameOver.winner === "police" ? "bg-blue-500" : "bg-red-500"}`}>
                <div className="text-5xl mb-2">{gameOver.winner === "police" ? "🚓" : "🕵️"}</div>
                <h2 className="text-2xl font-black text-white">{gameOver.winner === "police" ? "Police Win!" : "Thieves Win!"}</h2>
                <p className="text-white/80 text-sm font-semibold mt-1 capitalize">
                  {gameOver.reason === "all_caught" ? "All thieves caught" :
                   gameOver.reason === "police_caught" ? "Police caught!" : "Time ran out"}
                </p>
              </div>
              {/* Final scores */}
              <div className="px-6 py-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Final Scoreboard</p>
                <ul className="space-y-2">
                  {gameOver.scores.map((s, i) => (
                    <li key={s.id} className={`flex items-center justify-between rounded-xl px-4 py-2.5 border ${i === 0 ? "bg-yellow-50 border-yellow-200" : "bg-slate-50 border-slate-100"}`}>
                      <span className="flex items-center gap-2 font-bold text-slate-700">
                        <span className="text-slate-400 font-mono text-sm w-5">{i + 1}.</span>
                        {i === 0 && <span>🏆</span>}
                        {i === 1 && <span>🥈</span>}
                        {i === 2 && <span>🥉</span>}
                        {s.name}
                      </span>
                      <span className="font-black text-indigo-600 text-lg">{s.score} <span className="text-xs font-semibold text-slate-400">pts</span></span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-6 pb-6 text-center">
                <p className="text-slate-400 text-sm mb-3">Back to lobby in <span className="font-black text-slate-700">{redirectCount}</span>s…</p>
                <Link
                  href={`/police-thieves/lobby/${normalizedRoomId}`}
                  className="block w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-yellow-950 font-black rounded-2xl transition-colors text-center"
                >
                  Go to Lobby Now
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Disconnected warning */}
        {!connected && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl">
            ⚠️ Disconnected — trying to reconnect…
          </div>
        )}
      </div>
    </>
  );
}
