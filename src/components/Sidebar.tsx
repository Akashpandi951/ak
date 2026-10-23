import React from 'react';
import {
  Home,
  Crown,
  Grid3X3,
  Users,
  MessageSquare,
  UserCheck,
  Trophy,
  User,
  Settings,
  X,
  Copy,
  Check,
  Wifi,
  BarChart3,
  Gamepad2,
} from 'lucide-react';
import { UserProfile } from '../types/index.ts';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onOpenProfile?: () => void;
  currentUser: UserProfile;
  unreadCount?: number;
  friendsCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  onOpenProfile,
  currentUser,
  unreadCount = 0,
  friendsCount = 5,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [copied, setCopied] = React.useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'chess', label: 'Chess', icon: Crown },
    { id: 'ttt', label: 'Tic-Tac-Toe', icon: Grid3X3 },
    { id: 'multiplayer', label: 'Multiplayer', icon: Users },
    { id: 'friends', label: 'Friends', icon: UserCheck, count: friendsCount, badgeColor: 'bg-indigo-600 text-white' },
    { id: 'chat', label: 'Messages', icon: MessageSquare, count: unreadCount, badgeColor: 'bg-rose-500 text-white' },
    { id: 'leaderboard', label: 'Leaderboard', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleCopyUid = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(currentUser.public_uid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalWins = (currentUser.stats?.chess?.wins || 0) + (currentUser.stats?.ttt?.wins || 0);
  const totalDraws = (currentUser.stats?.chess?.draws || 0) + (currentUser.stats?.ttt?.draws || 0);
  const totalLosses = (currentUser.stats?.chess?.losses || 0) + (currentUser.stats?.ttt?.losses || 0);
  const totalGames = totalWins + totalDraws + totalLosses;
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 75;

  const handleNavClick = (id: string) => {
    if (id === 'profile' && onOpenProfile) {
      onOpenProfile();
      onCloseMobile?.();
      return;
    }
    onNavigate(id);
    onCloseMobile?.();
  };

  const content = (
    <div className="flex flex-col h-full bg-[#060a17]/95 border-r border-cyan-500/15 backdrop-blur-2xl w-64 select-none px-3 py-4 justify-between overflow-y-auto">
      {/* Top section: Mobile close or Brand */}
      <div className="space-y-4">
        {onCloseMobile && (
          <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-800/80 md:hidden">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Crown className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-sm tracking-wide text-white">
                ChessVerse <span className="text-cyan-400">3D</span>
              </span>
            </div>
            <button
              onClick={onCloseMobile}
              aria-label="Close navigation sidebar"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/90 via-indigo-600/85 to-purple-600/80 text-white shadow-lg shadow-blue-500/25 border border-cyan-400/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-cyan-200' : 'text-slate-400 group-hover:text-cyan-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[10px] min-w-[20px] h-5 px-1.5 rounded-full font-bold flex items-center justify-center shadow ${
                      item.badgeColor || 'bg-rose-500 text-white'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Cyber Luxury Widgets matching Reference Images 2, 3, 4 */}
      <div className="space-y-3 pt-4">
        {/* Brand & UID Copy Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-[#070c1b] border border-cyan-500/20 text-center relative overflow-hidden shadow-lg">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-24 h-24 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
          <div className="w-8 h-8 mx-auto mb-1.5 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 flex items-center justify-center">
            <Crown className="w-4 h-4 text-cyan-300" />
          </div>
          <p className="text-[10px] text-slate-400 tracking-wide">Play • Connect • Compete</p>
          <h4 className="text-xs font-extrabold text-white mt-0.5">
            ChessVerse <span className="text-cyan-400">3D</span>
          </h4>

          <div
            onClick={handleCopyUid}
            className="mt-2.5 px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-500/25 flex items-center justify-between cursor-pointer hover:border-cyan-400 transition-colors"
            title="Click to copy your unique UID"
          >
            <div className="text-left">
              <span className="block text-[9px] text-slate-500 uppercase">Your UID</span>
              <span className="font-mono text-[11px] font-bold text-cyan-300">
                {currentUser.public_uid}
              </span>
            </div>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
            )}
          </div>
        </div>

        {/* Career Stats Mini Card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/75 border border-cyan-500/15 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400">Your Wins</span>
                <span className="text-sm font-black text-white">{totalWins}</span>
              </div>
            </div>
            <div className="flex items-end gap-1 h-7">
              <span className="w-1.5 h-3 bg-cyan-500/40 rounded-full" />
              <span className="w-1.5 h-5 bg-cyan-400/70 rounded-full" />
              <span className="w-1.5 h-7 bg-gradient-to-t from-cyan-400 to-purple-400 rounded-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800/80 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">Your Draws</span>
              <span className="font-bold text-slate-200">{totalDraws}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px]">Win Rate</span>
              <span className="font-bold text-cyan-300">{winRate}%</span>
            </div>
          </div>
        </div>

        {/* Connection Status Pill */}
        <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-emerald-500/25 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-emerald-400">
            <Wifi className="w-3.5 h-3.5" />
            <span className="font-semibold">Connected</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop permanent sidebar */}
      <aside className="hidden md:block flex-shrink-0">{content}</aside>

      {/* Mobile slide-over drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative z-10">{content}</div>
        </div>
      )}

      {/* Mobile-First Premium Bottom Navigation Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#060a17]/95 backdrop-blur-xl border-t border-cyan-500/20 px-2 flex items-center justify-around"
      >
        {[
          { id: 'dashboard', label: 'Home', icon: Home },
          { id: 'chess', label: 'Chess 3D', icon: Crown },
          { id: 'ttt', label: 'Tic-Tac-Toe', icon: Grid3X3 },
          { id: 'chat', label: 'Chat', icon: MessageSquare, badge: unreadCount },
          { id: 'friends', label: 'Friends', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleNavClick(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
                isActive
                  ? 'text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1 w-6 h-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_8px_#22d3ee]" />
              )}
              <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : ''}`} />
              <span className="text-[10px] font-semibold mt-0.5">{tab.label}</span>
              {tab.badge ? (
                <span className="absolute top-0.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </>
  );
};
