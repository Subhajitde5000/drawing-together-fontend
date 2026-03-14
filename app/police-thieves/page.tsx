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
  const trimmedPlayerName = playerName.trim();
  const hasPlayerName = trimmedPlayerName.length > 0;

  const handleCreateRoom = async () => {
    if (!hasPlayerName || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const api = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
      const res = await fetch(
        `${api}/police-thieves/rooms?host_name=${encodeURIComponent(trimmedPlayerName)}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      localStorage.setItem("police-thieves-player-name", trimmedPlayerName);
      // Store the host's player_id so the lobby can send it on WS join
      localStorage.setItem(`pt-pid-${data.room_id}`, data.player_id);
      router.push(`/police-thieves/lobby/${data.room_id}`);
    } catch (err) {
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
         {/* Moving characters placeholders */}
         <div className="absolute top-[20%] left-[10%] text-4xl animate-bounce" style={{ animationDuration: '3s' }}>🏎️</div>
         <div className="absolute top-[60%] right-[15%] text-4xl animate-pulse" style={{ animationDuration: '2s' }}>🏃‍♂️</div>
         <div className="absolute top-[80%] left-[30%] text-4xl animate-pulse" style={{ animationDuration: '4s' }}>🌲</div>
      </div>

      <div className="relative z-10 w-full max-w-2xl text-center px-4 py-8">
        
        {/* Simple Back button */}
        <div className="absolute top-4 left-4 sm:fixed sm:top-8 sm:left-8">
          <Link href="/" className="px-5 py-3 bg-white rounded-full shadow-md text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200">
            ← Back to Hub
          </Link>
        </div>

        {/* Big Hero Section */}
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

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <button 
              onClick={handleCreateRoom}
              disabled={!hasPlayerName || creating}
              className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all ${hasPlayerName && !creating ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:-translate-y-1 active:translate-y-0" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
            >
              {creating ? "⏳ Creating..." : "Create Room"}
            </button>

            <button 
              onClick={handleJoinRoom}
              disabled={!hasPlayerName}
              className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all ${hasPlayerName ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 hover:-translate-y-1 active:translate-y-0" : "bg-slate-200 text-slate-400 cursor-not-allowed"}`}
            >
              Join Room
            </button>
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
            Thieves can catch the police to win.
          </p>
        </div>

      </div>
    </main>
  );
}
