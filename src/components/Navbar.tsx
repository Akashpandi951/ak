import React, { useState, useEffect, useRef } from 'react';
import {
  Crown,
  Search,
  Bell,
  ChevronDown,
  User,
  LogOut,
  Trash2,
  Settings as SettingsIcon,
  Gamepad2,
  Grid3X3,
  MessageSquare,
  Copy,
  Check,
  Menu,
  X,
  Volume2,
} from 'lucide-react';
import { UserProfile, GameInvitation } from '../types/index.ts';
import { api } from '../services/api.ts';

interface NavbarProps {
  currentUser: UserProfile;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onNavigate: (view: string, data?: any) => void;
  onToggleSidebar?: () => void;
  invitations: GameInvitation[];
  onAcceptInvitation: (inv: GameInvitation) => void;
  onDeclineInvitation: (inv: GameInvitation) => void;
  onlineCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onOpenProfile,
  onOpenSettings,
  onLogout,
  onDeleteAccount,
  onNavigate,
  onToggleSidebar,
  invitations,
  onAcceptInvitation,
  onDeclineInvitation,
  onlineCount,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Search autocomplete debounced
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.searchUsers(searchQuery.trim());
        setSearchResults(res.users || []);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyUID = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(currentUser.public_uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleInviteUser = async (user: UserProfile, gameType: 'chess' | 'ttt') => {
    try {
      const res = await api.sendInvitation(user.id, gameType);
      setShowSearchDropdown(false);
      setSearchQuery('');
      onNavigate(gameType === 'chess' ? 'chess' : 'ttt', { roomId: res.room.id });
    } catch (err: any) {
      console.error('Failed to send invite:', err);
    }
  };

  return (
    <header className="sticky top-0 z-40 h-16 w-full border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile hamburger & Brand */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-400/40 transition-shadow">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-lg leading-tight tracking-wider bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-400 bg-clip-text text-transparent">
              CHESSVERSE <span className="text-cyan-400 font-black">3D</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Center: Search Bar with Autocomplete */}
      <div ref={searchRef} className="relative flex-1 max-w-md mx-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players by username or UID (e.g. CV-7K9P2XAM)..."
            className="w-full h-10 pl-10 pr-4 text-sm bg-slate-900/90 border border-cyan-500/25 rounded-full text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {showSearchDropdown && (
          <div className="absolute left-0 right-0 top-12 bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden z-50 divide-y divide-slate-800">
            {isSearching ? (
              <div className="p-4 text-center text-sm text-slate-400">Searching players...</div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">
                No players found matching "{searchQuery}"
              </div>
            ) : (
              searchResults.map((user) => (
                <div
                  key={user.id}
                  className="p-3 flex items-center justify-between hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                        alt={user.username}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`;
                        }}
                        className="w-10 h-10 rounded-full object-cover border border-cyan-500/40"
                      />
                      {user.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200 text-sm">{user.username}</span>
                        <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/40">
                          {user.public_uid}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        Chess ELO: {user.stats?.chess?.rating || 1200} • TTT Wins: {user.stats?.ttt?.wins || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleInviteUser(user, 'chess')}
                      className="px-2.5 py-1 text-xs bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black rounded-lg transition-colors flex items-center gap-1 border border-cyan-500/30"
                      title="Invite to 3D Chess"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      Chess
                    </button>
                    <button
                      onClick={() => handleInviteUser(user, 'ttt')}
                      className="px-2.5 py-1 text-xs bg-violet-500/20 text-violet-300 hover:bg-violet-500 hover:text-white rounded-lg transition-colors flex items-center gap-1 border border-violet-500/30"
                      title="Invite to Tic-Tac-Toe"
                    >
                      <Grid3X3 className="w-3.5 h-3.5" />
                      TTT
                    </button>
                    <button
                      onClick={() => {
                        setShowSearchDropdown(false);
                        setSearchQuery('');
                        onNavigate('chat', { targetUserId: user.id });
                      }}
                      className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Send Private Message"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right: Online counter, Notification Bell & User Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Presence Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-emerald-500/30 text-xs text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{onlineCount || 1} Online</span>
        </div>

        {/* Notifications Bell */}
        <div ref={notificationsRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="View notifications"
            className="relative p-2 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {invitations.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center animate-bounce shadow-md">
                {invitations.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl backdrop-blur-xl p-3 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                <span className="font-semibold text-sm text-slate-200">Game Invitations</span>
                <span className="text-xs text-slate-400">{invitations.length} pending</span>
              </div>
              {invitations.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">
                  No pending game invitations
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-2.5 rounded-xl bg-slate-800/70 border border-cyan-500/20 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={inv.inviter?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${inv.inviter?.username || 'user'}`}
                            alt="inviter"
                            className="w-7 h-7 rounded-full object-cover border border-cyan-500/40"
                          />
                          <div>
                            <p className="text-xs font-semibold text-slate-200">
                              {inv.inviter?.username || 'Player'}
                            </p>
                            <p className="text-[10px] text-cyan-400 capitalize">
                              Challenged you to {inv.game_type === 'chess' ? '3D Chess' : 'Tic-Tac-Toe'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => {
                            setShowNotifications(false);
                            onAcceptInvitation(inv);
                          }}
                          className="flex-1 py-1 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-black rounded-lg hover:brightness-110 transition-all shadow-sm"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => onDeclineInvitation(inv)}
                          className="flex-1 py-1 text-xs font-semibold bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Dropdown Button */}
        <div ref={profileMenuRef} className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-label="User profile menu"
            className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-cyan-500/30 hover:border-cyan-400 hover:bg-slate-800/80 transition-all group"
          >
            <img
              src={currentUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`}
              alt={currentUser.username}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`;
              }}
              className="w-7 h-7 rounded-full object-cover border border-cyan-400/50"
            />
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                {currentUser.username}
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">
                {currentUser.public_uid}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 top-12 w-64 bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl backdrop-blur-xl p-2 z-50 divide-y divide-slate-800">
              <div className="p-3">
                <p className="text-xs text-slate-400">Signed in as</p>
                <p className="font-bold text-slate-100 text-sm">{currentUser.username}</p>
                <div
                  onClick={handleCopyUID}
                  className="mt-1.5 flex items-center justify-between px-2 py-1 bg-slate-950 rounded-lg border border-cyan-500/30 cursor-pointer hover:border-cyan-400 transition-colors"
                  title="Click to copy your unique UID"
                >
                  <span className="font-mono text-xs text-cyan-400">{currentUser.public_uid}</span>
                  {copiedUid ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
                  )}
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenProfile();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:text-cyan-300 hover:bg-slate-800/60 rounded-lg flex items-center gap-2.5 transition-colors"
                >
                  <User className="w-4 h-4 text-cyan-400" />
                  View Profile & Stats
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenSettings();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:text-cyan-300 hover:bg-slate-800/60 rounded-lg flex items-center gap-2.5 transition-colors"
                >
                  <SettingsIcon className="w-4 h-4 text-cyan-400" />
                  Settings
                </button>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:text-amber-400 hover:bg-slate-800/60 rounded-lg flex items-center gap-2.5 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-amber-400" />
                  Log Out
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenSettings();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg flex items-center gap-2.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
