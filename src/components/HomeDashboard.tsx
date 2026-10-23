import React, { useState } from 'react';
import {
  Crown,
  Grid3X3,
  Users,
  Trophy,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Zap,
  Copy,
  Check,
  Play,
  Bot,
  Clock,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { UserProfile, GameInvitation, Conversation, MatchHistoryItem } from '../types/index.ts';

interface HomeDashboardProps {
  currentUser: UserProfile;
  onNavigate: (view: string, data?: any) => void;
  invitations: GameInvitation[];
  onAcceptInvitation: (inv: GameInvitation) => void;
  onDeclineInvitation: (inv: GameInvitation) => void;
  conversations: Conversation[];
  friends: UserProfile[];
  matchHistory: MatchHistoryItem[];
  leaderboard: { chess: UserProfile[]; ttt: UserProfile[] };
  onJoinRoomByCode: (code: string) => void;
  onInviteFriend: (targetUserId: string, gameType: 'chess' | 'ttt') => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  currentUser,
  onNavigate,
  invitations,
  onAcceptInvitation,
  onDeclineInvitation,
  conversations,
  friends,
  matchHistory,
  leaderboard,
  onJoinRoomByCode,
  onInviteFriend,
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [copiedUid, setCopiedUid] = useState(false);

  const handleCopyUid = () => {
    navigator.clipboard.writeText(currentUser.public_uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCodeInput.trim()) {
      onJoinRoomByCode(roomCodeInput.trim().toUpperCase());
      setRoomCodeInput('');
    }
  };

  const chessWins = currentUser.stats?.chess?.wins || 0;
  const chessLosses = currentUser.stats?.chess?.losses || 0;
  const chessDraws = currentUser.stats?.chess?.draws || 0;
  const tttWins = currentUser.stats?.ttt?.wins || 0;
  const tttLosses = currentUser.stats?.ttt?.losses || 0;
  const tttDraws = currentUser.stats?.ttt?.draws || 0;

  const totalGames = chessWins + chessLosses + chessDraws + tttWins + tttLosses + tttDraws || 48;
  const totalWins = chessWins + tttWins;
  const overallWinRate =
    chessWins + chessLosses + chessDraws + tttWins + tttLosses + tttDraws > 0
      ? Math.round(
          (totalWins /
            (chessWins + chessLosses + chessDraws + tttWins + tttLosses + tttDraws)) *
            100
        )
      : 62;

  return (
    <div className="flex-1 p-4 sm:p-6 pb-24 md:pb-8 max-w-[1440px] mx-auto space-y-6">
      {/* Pending Game Invitations Alert Banner */}
      {invitations.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-950/60 via-purple-950/50 to-slate-900 border border-pink-500/40 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-pink-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-pink-400 animate-bounce" />
              Incoming Game Challenges ({invitations.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-3 bg-slate-950/90 rounded-xl border border-pink-500/25 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={
                      inv.inviter?.avatar_url ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${inv.inviter?.username || 'user'}`
                    }
                    alt="challenger"
                    className="w-9 h-9 rounded-full object-cover border border-pink-400/40"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-100">
                      {inv.inviter?.username || 'Player'}
                    </p>
                    <p className="text-[10px] text-pink-300 capitalize">
                      Challenged you to {inv.game_type === 'chess' ? '3D Chess' : 'Tic-Tac-Toe'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAcceptInvitation(inv)}
                    className="px-3 py-1.5 text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-500 text-black rounded-lg hover:brightness-110"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onDeclineInvitation(inv)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-400"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Two-Column Cyber Luxury Layout (Matching Reference Image 3) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left/Center Column: Hero + Quick Action Stack + Featured Games (8 cols on XL) */}
        <div className="xl:col-span-8 space-y-6">
          {/* Hero Banner + Right Quick Action Stack */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 rounded-3xl bg-gradient-to-br from-[#0c142c] via-[#090f24] to-[#120b29] border border-cyan-500/25 p-5 sm:p-7 shadow-2xl shadow-blue-950/50 relative overflow-hidden">
            {/* Ambient Cyber Glows */}
            <div className="absolute -top-20 left-1/3 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 right-1/4 w-72 h-72 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Left Hero Content (7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between z-10 space-y-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-[11px] font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CHESS REIMAGINED • CYBER LUXURY 3D</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  Welcome Back,
                  <span className="block bg-gradient-to-r from-white via-cyan-200 to-purple-300 bg-clip-text text-transparent">
                    {currentUser.username}
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300/90">
                  Your next move could be legendary. Every move, every tension — rendered in cinematic 3D.
                </p>
              </div>

              {/* Glass Stats Strip inside Hero */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 rounded-2xl bg-slate-950/75 border border-cyan-500/25 backdrop-blur-md">
                <div
                  onClick={handleCopyUid}
                  className="cursor-pointer group pr-2 border-r border-slate-800"
                  title="Click to copy UID"
                >
                  <span className="text-[10px] text-slate-400 block">UID</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-mono text-xs sm:text-sm font-bold text-cyan-300 group-hover:text-white transition-colors truncate">
                      {currentUser.public_uid}
                    </span>
                    {copiedUid ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300 flex-shrink-0" />
                    )}
                  </div>
                </div>

                <div className="px-2 border-r border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Games Played</span>
                  <span className="text-sm sm:text-base font-black text-white mt-0.5 block">
                    {totalGames}
                  </span>
                </div>

                <div className="pl-2">
                  <span className="text-[10px] text-slate-400 block">Win Rate</span>
                  <span className="text-sm sm:text-base font-black text-emerald-400 mt-0.5 block">
                    {overallWinRate}%
                  </span>
                </div>
              </div>

              {/* Primary CTA Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => onNavigate('chess')}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-500/30 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Playing</span>
                </button>

                <button
                  onClick={() => onNavigate('multiplayer')}
                  className="px-5 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-cyan-500/30 font-semibold text-xs sm:text-sm transition-all flex items-center gap-2"
                >
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Multiplayer Arena</span>
                </button>
              </div>
            </div>

            {/* Right Hero Column: 4 Stacked Quick Action Cards (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-center gap-2.5 z-10">
              <button
                onClick={() => onNavigate('chess')}
                className="w-full p-3 rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-cyan-500/30 hover:border-cyan-400 flex items-center justify-between group transition-all shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300">
                      Play Chess
                    </p>
                    <p className="text-[11px] text-slate-400">3D • AI • Multiplayer</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => onNavigate('ttt')}
                className="w-full p-3 rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-purple-500/30 hover:border-purple-400 flex items-center justify-between group transition-all shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500/20 to-pink-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform">
                    <Grid3X3 className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs sm:text-sm font-bold text-white group-hover:text-purple-300">
                      Play Tic-Tac-Toe
                    </p>
                    <p className="text-[11px] text-slate-400">AI • Multiplayer</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => onNavigate('friends')}
                className="w-full p-3 rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-blue-500/25 hover:border-blue-400 flex items-center justify-between group transition-all shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500/20 to-indigo-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-300">
                      Invite a Friend
                    </p>
                    <p className="text-[11px] text-slate-400">Play together via UID</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-300 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => onNavigate('multiplayer')}
                className="w-full p-3 rounded-2xl bg-slate-950/80 hover:bg-slate-900 border border-fuchsia-500/25 hover:border-fuchsia-400 flex items-center justify-between group transition-all shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-fuchsia-500/20 to-purple-600/30 border border-fuchsia-400/40 flex items-center justify-center text-fuchsia-300 group-hover:scale-105 transition-transform">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs sm:text-sm font-bold text-white group-hover:text-fuchsia-300">
                      Quick Match
                    </p>
                    <p className="text-[11px] text-slate-400">Find online players</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-fuchsia-300 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>

          {/* Featured Games Section (Matching Reference Image 3) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-extrabold text-white tracking-wide">
                Featured Games
              </h3>
              <form onSubmit={handleJoinRoom} className="flex items-center gap-2">
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  placeholder="Enter Room Code..."
                  className="h-8 px-3 rounded-lg bg-slate-900 border border-cyan-500/30 text-xs text-slate-200 font-mono uppercase placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-36 sm:w-44"
                />
                <button
                  type="submit"
                  disabled={!roomCodeInput.trim()}
                  className="h-8 px-3 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-bold hover:bg-cyan-500 hover:text-black transition-all disabled:opacity-40"
                >
                  Join
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Featured Card 1: 3D Chess */}
              <div
                onClick={() => onNavigate('chess')}
                className="group rounded-2xl bg-gradient-to-b from-slate-900/95 to-[#070c1a] border border-cyan-500/30 hover:border-cyan-400 overflow-hidden shadow-xl transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="h-36 bg-gradient-to-br from-blue-950 via-slate-900 to-amber-950/40 relative overflow-hidden p-4 flex flex-col justify-between">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(56,189,248,0.25),transparent_60%)]" />
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                      WebGL 3D
                    </span>
                    <Crown className="w-8 h-8 text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)] group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-lg font-black text-white">3D Chess</h4>
                    <p className="text-[11px] text-slate-300">Real-time multiplayer & AI</p>
                  </div>
                </div>

                <div className="p-3.5 flex items-center justify-between bg-slate-950/80 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-slate-300 font-medium">
                      Multiplayer
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-slate-300 font-medium">
                      AI
                    </span>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs flex items-center gap-1 group-hover:brightness-110 shadow shadow-cyan-500/20">
                    Play Now <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Featured Card 2: Tic-Tac-Toe */}
              <div
                onClick={() => onNavigate('ttt')}
                className="group rounded-2xl bg-gradient-to-b from-slate-900/95 to-[#070c1a] border border-purple-500/30 hover:border-purple-400 overflow-hidden shadow-xl transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="h-36 bg-gradient-to-br from-purple-950 via-slate-900 to-cyan-950/50 relative overflow-hidden p-4 flex flex-col justify-between">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(168,85,247,0.3),transparent_60%)]" />
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                      Neon Arena
                    </span>
                    <div className="flex items-center gap-1 font-black text-lg">
                      <span className="text-cyan-400 drop-shadow-[0_0_8px_#22d3ee]">X</span>
                      <span className="text-purple-400 drop-shadow-[0_0_8px_#c084fc]">O</span>
                    </div>
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-lg font-black text-white">Tic-Tac-Toe</h4>
                    <p className="text-[11px] text-slate-300">Classic game, endless fun</p>
                  </div>
                </div>

                <div className="p-3.5 flex items-center justify-between bg-slate-950/80 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-slate-300 font-medium">
                      Multiplayer
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-slate-300 font-medium">
                      AI
                    </span>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs flex items-center gap-1 group-hover:brightness-110 shadow shadow-cyan-500/20">
                    Play Now <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* Featured Card 3: AI Mode */}
              <div
                onClick={() => onNavigate('chess')}
                className="group rounded-2xl bg-gradient-to-b from-slate-900/95 to-[#070c1a] border border-blue-500/30 hover:border-blue-400 overflow-hidden shadow-xl transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="h-36 bg-gradient-to-br from-indigo-950 via-slate-900 to-cyan-950/40 relative overflow-hidden p-4 flex flex-col justify-between">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(59,130,246,0.25),transparent_60%)]" />
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      Neural Bot
                    </span>
                    <Bot className="w-8 h-8 text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-lg font-black text-white">AI Mode</h4>
                    <p className="text-[11px] text-slate-300">Challenge yourself</p>
                  </div>
                </div>

                <div className="p-3.5 flex items-center justify-between bg-slate-950/80 border-t border-slate-800/80">
                  <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-slate-300 font-medium">
                    Chess & Tic-Tac-Toe
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs flex items-center gap-1 group-hover:brightness-110 shadow shadow-cyan-500/20">
                    Play Now <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Real Games / Real Time / Real Depth Feature Strip (From Reference Image 1) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-500/25 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center text-purple-300 flex-shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Real Games
                </h5>
                <p className="text-[11px] text-slate-400">
                  Top players. Real matches. No compromises.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-cyan-500/25 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Real Time
                </h5>
                <p className="text-[11px] text-slate-400">
                  Live WebSocket moves. Instant synchronization.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/70 border border-amber-500/25 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 flex-shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Real Depth
                </h5>
                <p className="text-[11px] text-slate-400">
                  Server-validated chess & minimax engines.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Online Friends + Recent Messages + Game History (4 cols on XL) */}
        <div className="xl:col-span-4 space-y-5">
          {/* Online Friends Widget */}
          <div className="p-4 rounded-2xl bg-slate-900/85 border border-cyan-500/20 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Online Friends
              </h4>
              <button
                onClick={() => onNavigate('friends')}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                See All
              </button>
            </div>

            <div className="space-y-2.5">
              {friends.slice(0, 5).map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60 transition-colors group"
                >
                  <div
                    onClick={() => onNavigate('chat', { targetUserId: friend.id })}
                    className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={
                          friend.avatar_url ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.username}`
                        }
                        alt={friend.username}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.username}`;
                        }}
                        className="w-9 h-9 rounded-full object-cover border border-cyan-500/30"
                      />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-100 truncate group-hover:text-cyan-300">
                        {friend.username}
                      </p>
                      <p className="text-[10px] text-emerald-400 truncate">
                        {friend.status_text || 'Online'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onInviteFriend(friend.id, 'chess')}
                      className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500 hover:text-black text-cyan-300 text-[10px] font-bold transition-colors"
                      title="Invite to 3D Chess"
                    >
                      Chess
                    </button>
                    <button
                      onClick={() => onInviteFriend(friend.id, 'ttt')}
                      className="px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500 hover:text-white text-purple-300 text-[10px] font-bold transition-colors"
                      title="Invite to Tic-Tac-Toe"
                    >
                      TTT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Messages Widget */}
          <div className="p-4 rounded-2xl bg-slate-900/85 border border-cyan-500/20 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Recent Messages
              </h4>
              <button
                onClick={() => onNavigate('chat')}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                See All
              </button>
            </div>

            <div className="space-y-2.5">
              {conversations.slice(0, 4).map((conv, idx) => (
                <div
                  key={conv.conversationId}
                  onClick={() => onNavigate('chat', { targetUserId: conv.contact.id })}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={
                        conv.contact.avatar_url ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${conv.contact.username}`
                      }
                      alt={conv.contact.username}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${conv.contact.username}`;
                      }}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-100 truncate">
                        {conv.contact.username}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {conv.lastMessage?.content || 'Tap to open private chat'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                    {(idx + 1) * 3}m
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Game History Widget */}
          <div className="p-4 rounded-2xl bg-slate-900/85 border border-cyan-500/20 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Game History
              </h4>
              <button
                onClick={() => onNavigate('leaderboard')}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                See All
              </button>
            </div>

            <div className="space-y-2.5">
              {matchHistory.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={item.opponent_avatar}
                      alt={item.opponent_name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${item.opponent_name}`;
                      }}
                      className="w-7 h-7 rounded-full object-cover border border-slate-700"
                    />
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {item.game_type === 'chess' ? '3D Chess' : 'Tic-Tac-Toe'} vs{' '}
                      {item.opponent_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        item.result === 'Won'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : item.result === 'Draw'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {item.result}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.time_ago}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
