"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface PlayerInfo { id: string; name: string; is_connected: boolean; }

export default function PoliceThievesLobby() {
  const router = useRouter();
  const params = useParams();
  const rawRoomId = params.roomId;
  const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;
  const normalizedRoomId = roomId?.toUpperCase() || "";

  const wsRef = useRef<WebSocket | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [myPlayerId, setMyPlayerId] = useState("");
  const [hostId, setHostId] = useState("");
  const [status, setStatus] = useState<"connecting" | "connected" | "error" | "not_found">("connecting");
  const [startError, setStartError] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Name-entry gate: show prompt if coming via invite link with no stored name
  const [nameInput, setNameInput] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("police-thieves-player-name");
    if (stored?.trim()) setNameConfirmed(true);
  }, []);

  const handleConfirmName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    localStorage.setItem("police-thieves-player-name", trimmed);
    setNameConfirmed(true);
  };

  const isHost = !!myPlayerId && myPlayerId === hostId;
  const connectedCount = players.filter(p => p.is_connected).length;
  const canStart = isHost && connectedCount >= 2;

  useEffect(() => {
    if (!nameConfirmed || !normalizedRoomId) return;

    const name = localStorage.getItem("police-thieves-player-name") || "Player";
    let pid = localStorage.getItem(`pt-pid-${normalizedRoomId}`);
    if (!pid) {
      pid = crypto.randomUUID();
      localStorage.setItem(`pt-pid-${normalizedRoomId}`, pid);
    }
    setMyPlayerId(pid);

    const base = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000").replace(/\/$/, "");
    const ws = new WebSocket(`${base}/police-thieves/ws/${normalizedRoomId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      ws.send(JSON.stringify({ type: "join", player_id: pid, name }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "state") {
          setPlayers(msg.players ?? []);
          if (msg.host_id) setHostId(msg.host_id);
          // If room is ended and we're back in lobby, host auto-sends restart
          // so _next_police_id (Rule 6) is computed on the server
          if (msg.phase === "ended") {
            const myPid = localStorage.getItem(`pt-pid-${normalizedRoomId}`);
            if (myPid && msg.host_id === myPid) {
              ws.send(JSON.stringify({ type: "restart" }));
            }
            return; // don't navigate away yet
          }
          if (msg.phase && msg.phase !== "lobby") {
            router.push(`/police-thieves/game/${normalizedRoomId}`);
          }
        }
        if (msg.type === "error") {
          setStartError(msg.message ?? "Unknown error");
          setTimeout(() => setStartError(""), 3000);
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => setStatus("error");
    ws.onclose = (ev) => {
      if (ev.code === 4004) setStatus("not_found");
      else setStatus("error");
    };

    return () => { ws.close(); };
  }, [nameConfirmed, normalizedRoomId]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartGame = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setStartError("");
      wsRef.current.send(JSON.stringify({ type: "start_game" }));
    }
  };

  const handleCopyCode = async () => {
    try { await navigator.clipboard.writeText(normalizedRoomId); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); } catch { /* ignore */ }
  };

  const handleCopyJoinLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/police-thieves/lobby/${normalizedRoomId}`); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); } catch { /* ignore */ }
  };

  // Pad to 6 display slots
  const displaySlots = Array.from({ length: 6 }).map((_, i) => players[i] ?? null);

  // ── Name-entry screen (shown when joining via invite link with no stored name) ──
  if (!nameConfirmed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-100 text-slate-900 font-sans px-4">
        <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-10 shadow-2xl border border-white w-full max-w-sm text-center">
          <div className="text-5xl mb-4">👤</div>
          <h2 className="text-2xl font-black mb-2 text-slate-800">Enter Your Name</h2>
          <p className="text-slate-500 font-semibold mb-6 text-sm">
            You were invited to room <span className="font-mono font-black text-indigo-600">{normalizedRoomId}</span>
          </p>
          <input
            autoFocus
            className="w-full p-4 rounded-2xl text-xl font-bold bg-slate-50 border-2 border-transparent focus:border-indigo-400 focus:outline-none transition-colors text-slate-800 placeholder-slate-400 text-center shadow-inner mb-4"
            placeholder="Your alias..."
            maxLength={30}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirmName()}
          />
          <button
            onClick={handleConfirmName}
            disabled={!nameInput.trim()}
            className={`w-full py-4 rounded-2xl text-xl font-black uppercase tracking-wider transition-all ${nameInput.trim() ? "bg-yellow-400 hover:bg-yellow-300 text-yellow-950 shadow-lg" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
          >
            Join Lobby →
          </button>
          <Link href="/police-thieves" className="block mt-4 text-sm text-slate-400 hover:text-slate-600 font-semibold">
            ← Back
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-100 text-slate-900 font-sans overflow-hidden">
      
      <div className="absolute inset-0 z-0 overflow-hidden opacity-30 pointer-events-none">
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl text-center px-4 py-8 flex flex-col items-center">
        
        <div className="absolute top-4 left-4 sm:fixed sm:top-8 sm:left-8">
          <Link href="/police-thieves" className="px-5 py-3 bg-white rounded-full shadow-md text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200">
            ← Leave Lobby
          </Link>
        </div>

        <div className="mt-16 sm:mt-12 mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight drop-shadow-md flex flex-col items-center gap-4">
            <div className="flex gap-3 justify-center items-center text-3xl sm:text-5xl">
              <span className="bg-blue-100 border-2 border-blue-200 text-blue-600 px-5 py-2 rounded-xl shadow-sm rotate-[-2deg]">🚓 Police</span> 
              <span className="text-slate-400 text-2xl font-black">vs</span> 
              <span className="bg-red-100 border-2 border-red-200 text-red-600 px-5 py-2 rounded-xl shadow-sm rotate-[2deg]">🕵️ Thieves</span>
            </div>
          </h1>
        </div>

        {/* Connection status */}
        {status !== "connected" && (
          <div className={`mb-4 px-4 py-2 rounded-xl text-sm font-bold ${status === "not_found" ? "bg-orange-100 text-orange-700" : status === "error" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"}`}>
            {status === "connecting" && "⏳ Connecting..."}
            {status === "error" && "❌ Connection lost. Please refresh."}
            {status === "not_found" && (
              <>🚫 Room <span className="font-mono">{normalizedRoomId}</span> not found. <Link href="/police-thieves" className="underline">Create a new room</Link></>
            )}
          </div>
        )}

        <div className="bg-white/90 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] w-full max-w-md border border-white shadow-2xl mb-10">
          
          {/* Room Code */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-100 p-4 rounded-2xl border border-slate-200 mb-8 gap-4 shadow-inner">
            <div className="text-center sm:text-left">
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1">Room Code</p>
              <p className="font-mono text-3xl font-black tracking-widest text-slate-800">{normalizedRoomId}</p>
            </div>
            <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
              <button onClick={handleCopyCode} className={`px-5 py-2.5 rounded-xl font-bold transition-all border-2 w-full sm:w-auto ${copiedCode ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}>
                {copiedCode ? '✓ Copied' : 'Copy Code'}
              </button>
              <button onClick={handleCopyJoinLink} className={`px-5 py-2.5 rounded-xl font-bold transition-all border-2 w-full sm:w-auto ${copiedLink ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}>
                {copiedLink ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Player List */}
          <div className="mb-8">
            <div className="flex justify-between items-end mb-4 px-1">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">Players</h2>
              <span className="text-indigo-700 font-bold bg-indigo-100 px-3 py-1 rounded-lg border border-indigo-200">
                {connectedCount} / 6
              </span>
            </div>
            <ul className="space-y-2.5">
              {displaySlots.map((p, i) => (
                <li key={i} className={`flex justify-between items-center p-3.5 px-5 rounded-2xl ${p ? 'bg-slate-50 border-2 border-slate-100 shadow-sm' : 'bg-slate-100/50 border-2 border-dashed border-slate-200 text-slate-400'}`}>
                  {p ? (
                    <span className="font-bold text-lg flex items-center gap-3 text-slate-700">
                      <span className={`text-xl ${p.is_connected ? '' : 'opacity-40'}`}>👤</span>
                      {p.name}
                      {p.id === myPlayerId && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md ml-1">YOU</span>}
                      {p.id === hostId && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-md ml-1">HOST</span>}
                      {!p.is_connected && <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-md ml-1">offline</span>}
                    </span>
                  ) : (
                    <span className="font-bold flex items-center gap-3 pl-1">
                      <span className="text-slate-300">+</span> Waiting...
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Action */}
          <div className="flex flex-col gap-3 mt-4">
            {startError && (
              <p className="text-red-500 text-sm font-bold text-center">⚠️ {startError}</p>
            )}
            <button
              onClick={handleStartGame}
              disabled={!canStart}
              className={`w-full py-4 rounded-2xl text-xl font-black uppercase tracking-wider transition-all border-b-4 active:border-b-0 active:translate-y-1 ${canStart ? 'bg-yellow-400 hover:bg-yellow-300 text-yellow-950 border-yellow-500 shadow-[0_4px_20px_rgba(250,204,21,0.3)]' : 'bg-slate-200 text-slate-400 border-transparent cursor-not-allowed'}`}
            >
              {!isHost ? 'Waiting for host...' : connectedCount < 2 ? `Waiting for players… (${connectedCount}/2)` : 'Start Game ▶'}
            </button>
          </div>
        </div>

        <div className="max-w-md mx-auto text-center bg-white/70 p-6 rounded-3xl border border-white/50 shadow-lg backdrop-blur-md">
          <h3 className="text-slate-500 font-black uppercase tracking-widest text-sm mb-4 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-slate-300"></span> Game Rules <span className="h-px w-8 bg-slate-300"></span>
          </h3>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-slate-600 text-sm font-medium leading-relaxed shadow-inner">
            <p className="mb-2"><span className="text-blue-600 font-bold">1 Police</span> vs <span className="text-red-500 font-bold">{Math.max(1, connectedCount - 1)} Thieves</span></p>
            <p className="mb-2">Thieves get <span className="font-bold">30 seconds</span> to hide before the police can move.</p>
            <p>Thieves can catch the police to win!</p>
          </div>
        </div>
      </div>
    </main>
  );
}
