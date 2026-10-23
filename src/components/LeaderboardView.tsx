import React, { useState } from 'react';
import { Trophy, Crown, Grid3X3, ArrowRight, User } from 'lucide-react';
import { UserProfile } from '../types/index.ts';

interface LeaderboardViewProps {
  currentUser: UserProfile;
  leaderboard: { chess: UserProfile[]; ttt: UserProfile[] };
  onInviteGame: (userId: string, gameType: 'chess' | 'ttt') => void;
  onNavigateChat: (userId: string) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  currentUser,
  leaderboard,
  onInviteGame,
  onNavigateChat,
}) => {
  const [activeTab, setActiveTab] = useState<'chess' | 'ttt'>('chess');

  const list = activeTab === 'chess' ? leaderboard.chess || [] : leaderboard.ttt || [];

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Hall of Fame & Rankings</span>
        </div>
        <h2 className="text-3xl font-black text-white">Global Player Leaderboard</h2>
        <p className="text-xs text-slate-400">
          Compete in ranked matches to climb the 3D Chess and Tic-Tac-Toe ladders.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center">
        <div className="bg-slate-900 p-1 rounded-2xl border border-cyan-500/30 flex gap-1">
          <button
            onClick={() => setActiveTab('chess')}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'chess'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Crown className="w-4 h-4" />
            3D Chess Rankings
          </button>
          <button
            onClick={() => setActiveTab('ttt')}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'ttt'
                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            Tic-Tac-Toe Champions
          </button>
        </div>
      </div>

      {/* Rankings Table */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-cyan-500/20 shadow-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase font-bold tracking-wider">
              <th className="py-3 px-3">Rank</th>
              <th className="py-3 px-3">Player</th>
              <th className="py-3 px-3">UID</th>
              {activeTab === 'chess' ? (
                <>
                  <th className="py-3 px-3 text-right">Rating</th>
                  <th className="py-3 px-3 text-right">W / L / D</th>
                </>
              ) : (
                <>
                  <th className="py-3 px-3 text-right">Victories</th>
                  <th className="py-3 px-3 text-right">Losses</th>
                </>
              )}
              <th className="py-3 px-3 text-right">Challenge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {list.map((player, idx) => {
              const isCurrentUser = player.id === currentUser.id;
              return (
                <tr
                  key={player.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    isCurrentUser ? 'bg-cyan-950/30' : ''
                  }`}
                >
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-black text-xs ${
                        idx === 0
                          ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30'
                          : idx === 1
                          ? 'bg-slate-300 text-black'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <img
                          src={player.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.username}`}
                          alt={player.username}
                          className="w-8 h-8 rounded-full object-cover border border-slate-700"
                        />
                        {player.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-slate-900" />
                        )}
                      </div>
                      <span className="font-bold text-slate-100">
                        {player.username} {isCurrentUser && '(You)'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 font-mono text-cyan-400">{player.public_uid}</td>

                  {activeTab === 'chess' ? (
                    <>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-cyan-300 text-sm">
                        {player.stats?.chess?.rating || (player as any).rating || 1200}
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono">
                        {player.stats?.chess?.wins ?? (player as any).wins ?? 0} /{' '}
                        {player.stats?.chess?.losses ?? (player as any).losses ?? 0} /{' '}
                        {player.stats?.chess?.draws ?? (player as any).draws ?? 0}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-violet-300 text-sm">
                        {player.stats?.ttt?.wins ?? (player as any).wins ?? 0}
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-400 font-mono">
                        {player.stats?.ttt?.losses ?? (player as any).losses ?? 0}
                      </td>
                    </>
                  )}

                  <td className="py-3.5 px-3 text-right">
                    {!isCurrentUser ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onInviteGame(player.id, activeTab)}
                          className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black rounded-lg text-xs font-semibold transition-colors"
                        >
                          Challenge
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Your Rank</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
