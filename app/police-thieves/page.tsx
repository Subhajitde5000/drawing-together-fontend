"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PoliceThievesHome() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // Room settings
  const [hideTime, setHideTime] = useState(30);
  const [roundTime, setRoundTime] = useState(120);   // 0 = no limit
  const [totalRounds, setTotalRounds] = useState(1);

  const trimmedPlayerName = playerName.trim();
  const hasPlayerName = trimmedPlayerName.length > 0;

  const handleCreateRoom = async () => {
    if (!hasPlayerName || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const api = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
      const params = new URLSearchParams({
        host_name:    trimmedPlayerName,
        round_time:   String(roundTime),
        hide_time:    String(hideTime),
        total_rounds: String(totalRounds),
      });
      const res = await fetch(`${api}/police-thieves/rooms?${params}`, { method: "POST" });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      localStorage.setItem("police-thieves-player-name", trimmedPlayerName);
      localStorage.setItem(`pt-pid-${data.room_id}`, data.player_id);
      router.push(`/police-thieves/lobby/${data.room_id}`);
    } catch {
      setCreateError("Could not reach server. Is the backend running?");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (!hasPlayerName) return;
    const code = roomCode.trim().toUpperCase();
    if (code) {
      localStorage.setItem("police-thieves-player-name", trimmedPlayerName);
      router.push(`/police-thieves/lobby/${code}`);
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-100 text-slate-900 font-sans overflow-hidden">
      
      {/* Animated Background Map Grid */}
      <div className="absolute inset-0 z-0 overflow-hidden opacity-30 pointer-events-none">
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
         <div className="absolute top-[20%] left-[10%] text-4xl animate-bounce" style={{ animationDuration: '3s' }}>🏎️</div>
         <div className="absolute top-[60%] right-[15%] text-4xl animate-pulse" style={{ animationDuration: '2s' }}>🏃‍♂️</div>
         <div className="absolute top-[80%] left-[30%] text-4xl animate-pulse" style={{ animationDuration: '4s' }}>🌲</div>
      </div>

      <div className="relative z-10 w-full max-w-2xl text-center px-4 py-8">
        
        <div className="absolute top-4 left-4 sm:fixed sm:top-8 sm:left-8">
          <Link href="/" className="px-5 py-3 bg-white rounded-full shadow-md text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200">
            ← Back to Hub
          </Link>
        </div>

        <h1 className="mt-12 sm:mt-0 text-5xl sm:text-7xl font-black mb-6 tracking-tight drop-shadow-md flex flex-col items-center gap-6">
          <div className="flex gap-4 justify-center items-center text-4xl sm:text-6xl">
            <span className="bg-blue-100 border-2 border-blue-200 text-blue-600 px-6 py-3 rounded-2xl shadow-sm rotate-[-4deg] hover:rotate-0 transition-transform">🚓 Police</span> 
            <span className="text-slate-400 text-3xl">vs</span> 
            <span className="bg-red-100 border-2 border-red-200 text-red-600 px-6 py-3 rounded-2xl shadow-sm rotate-[4deg] hover:rotate-0 transition-transform">🕵️ Thieves</span>
          </div>
        </h1>

        <p className="mb-12 text-xl sm:text-2xl font-bold text-slate-500 max-w-lg mx-auto">
          Hide. Escape. Hunt your friends in this fast-paced multiplayer chase!
        </p>

        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 shadow-2xl border border-white mb-10 mx-auto w-full max-w-lg">
          {/* Name input */}
          <div className="mb-8 rounded-2xl border-2 border-indigo-100 bg-indigo-50/70 p-5">
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-indigo-500">Step 1</p>
            <h2 className="mb-4 text-left text-lg font-black uppercase tracking-wide text-slate-800">Enter Your Name</h2>
            <input
              className="w-full p-5 rounded-2xl text-xl font-bold bg-white border-2 border-transparent focus:border-indigo-400 focus:outline-none transition-colors text-slate-800 placeholder-slate-400 text-center shadow-inner"
              placeholder="Enter your alias..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
            {!hasPlayerName && (
              <p className="mt-3 text-sm font-semibold text-slate-500">Please enter your name to create or join a room.</p>
            )}
          </div>

          <button className="w-full bg-yellow-400 hover:bg-yellow-300 text-slate-900 px-10 py-6 rounded-2xl text-2xl font-black uppercase tracking-wide hover:scale-105 transition-transform active:scale-95 shadow-[0_10px_30px_rgba(250,204,21,0.5)] mb-8 flex justify-center items-center gap-3">
            ▶ Play Quick Match
          </button>

          <div className="flex items-center gap-4 mb-8">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Step 2: Make or join a room</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>

          {/* Create Room + Settings */}
          <div className="mb-4">
            <div className="flex gap-3 mb-3">
              <button 
                onClick={() => hasPlayerName && setShowSettings(s => !s)}
                disabled={!hasPlayerName}
                className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all ${hasPlayerName ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:-translate-y-1 active:translate-y-0" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
              >
                🎛️ Create Room
              </button>
              <button 
                onClick={handleJoinRoom}
                disabled={!hasPlayerName}
                className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all ${hasPlayerName ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 hover:-translate-y-1 active:translate-y-0" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
              >
                Join Room
              </button>
            </div>

            {/* Settings panel — slides in when showSettings */}
            {showSettings && (
              <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/60 p-6 mb-3 text-left">
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 mb-5">Room Settings</h3>

                {/* Hide time */}
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 text-sm">🕵️ Hiding Time</label>
                    <span className="text-blue-600 font-black text-sm">{hideTime}s</span>
                  </div>
                  <input type="range" min={10} max={120} step={5} value={hideTime}
                    onChange={e => setHideTime(Number(e.target.value))}
                    className="w-full accent-blue-500" />
                  <div className="flex justify-between text-xs text-slate-400 mt-1"><span>10s</span><span>120s</span></div>
                </div>

                {/* Round time */}
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-700 text-sm">🚓 Police Hunt Time</label>
                    <span className="text-blue-600 font-black text-sm">{roundTime === 0 ? "∞ No Limit" : `${roundTime}s`}</span>
                  </div>
                  <input type="range" min={30} max={600} step={10} value={roundTime === 0 ? 600 : roundTime}
                    disabled={roundTime === 0}
                    onChange={e => setRoundTime(Number(e.target.value))}
                    className={`w-full accent-blue-500 ${roundTime === 0 ? "opacity-30" : ""}`} />
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex gap-1 text-xs text-slate-400"><span>30s</span><span className="mx-1">·</span><span>600s</span></div>
                    <button
                      onClick={() => setRoundTime(r => r === 0 ? 120 : 0)}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition-all border ${roundTime === 0 ? "bg-blue-500 text-white border-blue-500" : "bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600"}`}
                    >
                      ∞ No Limit
                    </button>
                  </div>
                </div>

                {/* Rounds */}
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-bold text-slate-700 text-sm">🔄 Number of Rounds</label>
                    <span className="text-blue-600 font-black text-sm">{totalRounds}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[1,2,3,5,7,10].map(n => (
                      <button key={n} onClick={() => setTotalRounds(n)}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${totalRounds === n ? "bg-blue-500 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-blue-50"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-white/80 rounded-xl p-3 text-xs text-slate-500 font-semibold mb-4">
                  Thieves hide for <b className="text-blue-600">{hideTime}s</b> · Police hunts for <b className="text-blue-600">{roundTime === 0 ? "∞ no limit" : `${roundTime}s`}</b> · <b className="text-blue-600">{totalRounds}</b> round{totalRounds > 1 ? "s" : ""}
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={creating}
                  className={`w-full py-4 rounded-2xl font-black text-lg uppercase tracking-wide transition-all ${!creating ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:-translate-y-1 active:translate-y-0" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
                >
                  {creating ? "⏳ Creating..." : "✅ Confirm & Create Room"}
                </button>
              </div>
            )}
          </div>

          {createError && (
            <p className="text-red-500 text-sm font-semibold text-center mb-4">{createError}</p>
          )}

          <div className="flex gap-2 p-2 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
            <input
              className="flex-1 p-3 px-5 rounded-xl font-bold bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none uppercase tracking-widest disabled:text-slate-400"
              placeholder="Code"
              maxLength={6}
              value={roomCode}
              disabled={!hasPlayerName}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
            />
            <button 
              onClick={handleJoinRoom}
              disabled={!hasPlayerName}
              className={`px-8 py-3 rounded-xl font-bold transition-colors shadow-sm ${hasPlayerName ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
            >
              Enter
            </button>
          </div>
        </div>

        {/* How to Play */}
        <div className="max-w-md mx-auto text-center bg-white/70 p-8 rounded-3xl border border-white/50 shadow-lg backdrop-blur-md">
          <h2 className="text-2xl font-black mb-4 text-slate-800 uppercase tracking-wide">How to Play</h2>
          <p className="text-slate-600 font-semibold leading-relaxed text-lg">
            One player becomes <span className="text-blue-500">Police</span>. Others are <span className="text-red-500">Thieves</span>.<br/>
            Hide before the timer ends. Police must catch all thieves.<br/>
            Thieves can catch the police from behind to win.
          </p>
        </div>

      </div>
    </main>
  );
}

