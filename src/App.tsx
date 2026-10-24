/**
 * ChessVerse 3D - Full-Stack Gaming Platform Master Component
 */
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { UserProfile, GameInvitation, Conversation, MatchHistoryItem } from './types/index.ts';
import { api, getAuthToken, clearAuthToken, wsService } from './services/api.ts';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { HomeDashboard } from './components/HomeDashboard.tsx';
import { Crown, X } from 'lucide-react';

// Code-split heavy components for instant initial page loading & reduced memory footprint
const Chess3DGame = lazy(() =>
  import('./components/Chess3DGame.tsx').then((m) => ({ default: m.Chess3DGame }))
);
const TicTacToeGame = lazy(() =>
  import('./components/TicTacToeGame.tsx').then((m) => ({ default: m.TicTacToeGame }))
);
const WhatsAppChat = lazy(() =>
  import('./components/WhatsAppChat.tsx').then((m) => ({ default: m.WhatsAppChat }))
);
const MultiplayerHub = lazy(() =>
  import('./components/MultiplayerHub.tsx').then((m) => ({ default: m.MultiplayerHub }))
);
const FriendsView = lazy(() =>
  import('./components/FriendsView.tsx').then((m) => ({ default: m.FriendsView }))
);
const LeaderboardView = lazy(() =>
  import('./components/LeaderboardView.tsx').then((m) => ({ default: m.LeaderboardView }))
);
const ProfileModal = lazy(() =>
  import('./components/ProfileModal.tsx').then((m) => ({ default: m.ProfileModal }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal.tsx').then((m) => ({ default: m.SettingsModal }))
);

const ViewFallback = () => (
  <div className="flex-1 flex items-center justify-center p-12 min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-bold text-cyan-300 tracking-widest uppercase">Loading Module...</span>
    </div>
  </div>
);

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Navigation
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [viewParams, setViewParams] = useState<any>({});
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);

  // Modals & Toast
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-time state
  const [invitations, setInvitations] = useState<GameInvitation[]>([]);
  const [incomingChallenge, setIncomingChallenge] = useState<GameInvitation | null>(null);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ chess: UserProfile[]; ttt: UserProfile[] }>({
    chess: [],
    ttt: [],
  });
  const [onlineCount] = useState<number>(6);

  const playInviteSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch {
      // Audio playback restrictions fallback
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch app data in a single consolidated request (with Promise.allSettled fallback)
  const refreshAppData = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const boot = await api.getBootstrap();
      setInvitations(boot.invitations || []);
      setFriends(boot.friends || []);
      setPendingRequests(boot.pendingRequests || []);
      setConversations(boot.conversations || []);
      setLeaderboard(boot.leaderboard || { chess: [], ttt: [] });
      setMatchHistory(boot.history || []);
    } catch {
      // Fallback: fault-tolerant individual fetches without throwing on partial rate-limit
      const results = await Promise.allSettled([
        api.getInvitations(),
        api.getFriends(),
        api.getConversations(),
        api.getLeaderboard(),
        api.getMatchHistory(),
      ]);
      if (results[0].status === 'fulfilled') {
        setInvitations(results[0].value.invitations || []);
      }
      if (results[1].status === 'fulfilled') {
        setFriends(results[1].value.friends || []);
        setPendingRequests(results[1].value.pendingRequests || []);
      }
      if (results[2].status === 'fulfilled') {
        setConversations(results[2].value.conversations || []);
      }
      if (results[3].status === 'fulfilled') {
        setLeaderboard(results[3].value || { chess: [], ttt: [] });
      }
      if (results[4].status === 'fulfilled') {
        setMatchHistory(results[4].value.history || []);
      }
    }
  }, [currentUser?.id]);

  // Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isAutoStart = urlParams.get('autostart') === '1';
      const requestedUser = urlParams.get('user');
      const requestedRoom = urlParams.get('room');
      const requestedGame = urlParams.get('game');

      if (requestedUser) {
        clearAuthToken();
        try {
          const res = await api.login(requestedUser, 'chessverse123');
          setCurrentUser(res.user);
        } catch {
          try {
            const regRes = await api.register(requestedUser, 'chessverse123');
            setCurrentUser(regRes.user);
          } catch (err) {
            console.warn('Requested user login/register failed:', err);
          }
        }
      } else {
        const token = getAuthToken();
        if (token) {
          try {
            const boot = await api.getBootstrap();
            setCurrentUser(boot.user);
            setInvitations(boot.invitations || []);
            setFriends(boot.friends || []);
            setPendingRequests(boot.pendingRequests || []);
            setConversations(boot.conversations || []);
            setLeaderboard(boot.leaderboard || { chess: [], ttt: [] });
            setMatchHistory(boot.history || []);
            wsService.connect(token);
          } catch (err: any) {
            // Only clear token if explicitly unauthorized (401); preserve token on transient network/429 errors
            if (err?.message && err.message.includes('401')) {
              clearAuthToken();
            } else {
              try {
                const res = await api.getMe();
                setCurrentUser(res.user);
                wsService.connect(token);
              } catch {
                clearAuthToken();
              }
            }
          }
        } else if (isAutoStart) {
          try {
            const res = await api.login('Grandmaster_Magnus', 'chessverse123');
            setCurrentUser(res.user);
          } catch (err) {
            console.warn('Autostart login failed:', err);
          }
        }
      }

      if (requestedRoom) {
        setActiveView(requestedGame === 'ttt' ? 'ttt' : 'chess');
        setViewParams({ roomId: requestedRoom });
      } else if (requestedGame === 'chess' || requestedGame === 'ttt') {
        setActiveView(requestedGame);
      }
      setIsLoadingUser(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      const token = getAuthToken();
      if (token) {
        wsService.connect(token);
      }
      refreshAppData();
    } else {
      wsService.disconnect();
    }
  }, [currentUser?.id, refreshAppData]);

  // Periodic background check for pending invitations & instant check on window/tab focus
  useEffect(() => {
    if (!currentUser?.id) return;

    const checkInvitations = async () => {
      try {
        const res = await api.getInvitations();
        if (Array.isArray(res.invitations)) {
          setInvitations((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const newOnes = res.invitations.filter((i) => !existingIds.has(i.id));
            if (newOnes.length > 0) {
              setIncomingChallenge(newOnes[0]);
              playInviteSound();
            }
            return res.invitations;
          });
        }
      } catch {
        // Silently ignore background polling errors
      }
    };

    const interval = setInterval(checkInvitations, 8000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const token = getAuthToken();
        if (token) wsService.connect(token);
        checkInvitations();
      }
    };
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
    };
  }, [currentUser?.id]);

  // WebSocket global real-time event listeners
  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubs = [
      wsService.on('game_invitation', (data: any) => {
        if (data.invitation) {
          setInvitations((prev) => {
            const filtered = prev.filter((i) => i.id !== data.invitation.id);
            return [data.invitation, ...filtered];
          });
          setIncomingChallenge(data.invitation);
          playInviteSound();
        }
      }),

      wsService.on('invitation_accepted', (data: any) => {
        const gameType = data.gameType || 'chess';
        showToast(`${data.accepter?.username || 'Opponent'} accepted! Starting match...`);
        handleNavigate(gameType === 'chess' ? 'chess' : 'ttt', { roomId: data.roomId });
      }),

      wsService.on('invitation_declined', () => {
        showToast('Your game challenge was declined.');
      }),

      wsService.on('new_message', () => {
        api
          .getConversations()
          .then((res) => {
            setConversations(res.conversations || []);
          })
          .catch(() => {});
      }),

      wsService.on('friend_request', () => {
        api
          .getFriends()
          .then((res) => {
            setPendingRequests(res.pendingRequests || []);
          })
          .catch(() => {});
      }),

      wsService.on('presence', (data: any) => {
        setFriends((prev) =>
          prev.map((f) => (f.id === data.userId ? { ...f, isOnline: data.isOnline } : f))
        );
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [currentUser?.id]);

  const handleNavigate = (view: string, data?: any) => {
    setActiveView(view);
    setViewParams(data || {});
    setIsSidebarOpenMobile(false);
  };

  const handleAcceptInvitation = async (inv: GameInvitation) => {
    try {
      setIncomingChallenge(null);
      const res = await api.respondInvitation(inv.id, 'accept');
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      handleNavigate(inv.game_type === 'chess' ? 'chess' : 'ttt', { roomId: res.roomId });
    } catch (err: any) {
      showToast(err.message || 'Failed to accept invitation');
    }
  };

  const handleDeclineInvitation = async (inv: GameInvitation) => {
    try {
      setIncomingChallenge(null);
      await api.respondInvitation(inv.id, 'decline');
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      showToast('Game challenge declined');
    } catch (err) {
      console.error('Failed to decline invitation:', err);
    }
  };

  const handleInviteFriend = async (targetUserId: string, gameType: 'chess' | 'ttt') => {
    try {
      const res = await api.sendInvitation(targetUserId, gameType);
      if (res.invitation?.status === 'accepted') {
        handleNavigate(gameType === 'chess' ? 'chess' : 'ttt', { roomId: res.room.id });
      } else {
        showToast('Challenge sent! Match will start once accepted.');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to send game challenge');
    }
  };

  const handleJoinRoomByCode = async (code: string) => {
    try {
      const res = await api.joinRoom(code);
      handleNavigate(res.room.game_type === 'chess' ? 'chess' : 'ttt', { roomId: res.room.id });
    } catch (err: any) {
      showToast(err.message || 'Invalid room code');
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    wsService.disconnect();
    setCurrentUser(null);
    setActiveView('dashboard');
  };

  const handleDeleteAccount = () => {
    clearAuthToken();
    wsService.disconnect();
    setCurrentUser(null);
    setActiveView('dashboard');
  };

  // Calculate unread chat messages
  const totalUnreadMessages = conversations.reduce(
    (acc, curr) => acc + (curr.unreadCount || 0),
    0
  );

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-cyan-400">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center animate-spin mb-4 shadow-xl shadow-cyan-500/20">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
        </div>
        <p className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase">
          Loading ChessVerse 3D...
        </p>
      </div>
    );
  }

  // If not authenticated, render login/registration modal
  if (!currentUser) {
    return (
      <AuthModal
        onSuccess={(user) => {
          setCurrentUser(user);
          const token = getAuthToken();
          if (token) {
            wsService.connect(token);
          }
        }}
      />
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#060913] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Toast notification banner */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-cyan-500/40 text-cyan-300 text-xs font-bold shadow-2xl">
          {toastMessage}
        </div>
      )}

      {/* Real-time Incoming Game Invitation Modal Overlay */}
      {incomingChallenge && (
        <div className="fixed inset-x-4 top-20 sm:top-20 max-w-md mx-auto z-[9999] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <div className="relative overflow-hidden rounded-2xl bg-slate-900/98 border-2 border-cyan-400/80 shadow-2xl shadow-cyan-950/80 p-4.5 backdrop-blur-2xl">
            {/* Top glowing ambient accent */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={
                      incomingChallenge.inviter?.avatar_url ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${incomingChallenge.inviter?.username || 'user'}`
                    }
                    alt={incomingChallenge.inviter?.username || 'Challenger'}
                    className="w-12 h-12 rounded-full object-cover border-2 border-cyan-400 shadow-md shadow-cyan-500/30"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      Incoming Challenge
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      {incomingChallenge.game_type === 'chess' ? '3D Chess' : 'Tic-Tac-Toe'}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm sm:text-base text-white mt-1 truncate">
                    {incomingChallenge.inviter?.username || 'Player'}
                  </h4>
                  <p className="text-xs text-cyan-300/80">
                    Challenged you to a live {incomingChallenge.game_type === 'chess' ? 'Chess' : 'Tic-Tac-Toe'} match!
                  </p>
                </div>
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => setIncomingChallenge(null)}
                aria-label="Dismiss challenge popup"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Accept & Decline Actions */}
            <div className="flex items-center gap-2.5 mt-4 pt-3 border-t border-slate-800/80">
              <button
                onClick={() => handleAcceptInvitation(incomingChallenge)}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-600 hover:brightness-110 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Crown className="w-4 h-4" />
                Accept & Play Now
              </button>
              <button
                onClick={() => handleDeclineInvitation(incomingChallenge)}
                className="py-2.5 px-4 bg-slate-800/90 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 font-bold text-xs rounded-xl border border-slate-700/60 transition-colors cursor-pointer active:scale-95"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
        onNavigate={handleNavigate}
        onToggleSidebar={() => setIsSidebarOpenMobile(!isSidebarOpenMobile)}
        invitations={invitations}
        onAcceptInvitation={handleAcceptInvitation}
        onDeclineInvitation={handleDeclineInvitation}
        onlineCount={onlineCount}
      />

      {/* Main Body Layout: Sidebar + Active View Arena */}
      <div className="flex-1 min-h-0 flex overflow-hidden pb-16 md:pb-0">
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          onOpenProfile={() => setShowProfileModal(true)}
          currentUser={currentUser}
          unreadCount={totalUnreadMessages}
          friendsCount={friends.length}
          isOpenMobile={isSidebarOpenMobile}
          onCloseMobile={() => setIsSidebarOpenMobile(false)}
        />

        {/* Main Content Area */}
        <main
          className={`flex-1 min-h-0 ${
            activeView === 'chat' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'
          } bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-[#060913] to-[#040710]`}
        >
          {activeView === 'dashboard' && (
            <HomeDashboard
              currentUser={currentUser}
              onNavigate={handleNavigate}
              invitations={invitations}
              onAcceptInvitation={handleAcceptInvitation}
              onDeclineInvitation={handleDeclineInvitation}
              conversations={conversations}
              friends={friends}
              matchHistory={matchHistory}
              leaderboard={leaderboard}
              onJoinRoomByCode={handleJoinRoomByCode}
              onInviteFriend={handleInviteFriend}
            />
          )}

          <Suspense fallback={<ViewFallback />}>
            {activeView === 'chess' && (
              <Chess3DGame
                key={viewParams.roomId || 'chess-local'}
                currentUser={currentUser}
                initialRoomId={viewParams.roomId}
                onExit={() => {
                  refreshAppData();
                  handleNavigate('dashboard');
                }}
                onNavigateChat={(userId) => handleNavigate('chat', { targetUserId: userId })}
              />
            )}

            {activeView === 'ttt' && (
              <TicTacToeGame
                key={viewParams.roomId || 'ttt-local'}
                currentUser={currentUser}
                initialRoomId={viewParams.roomId}
                onExit={() => {
                  refreshAppData();
                  handleNavigate('dashboard');
                }}
                onNavigateChat={(userId) => handleNavigate('chat', { targetUserId: userId })}
              />
            )}

            {activeView === 'chat' && (
              <WhatsAppChat
                key={viewParams.targetUserId || 'chat'}
                currentUser={currentUser}
                initialTargetUserId={viewParams.targetUserId}
                onInviteGame={handleInviteFriend}
                onBackToDashboard={() => handleNavigate('dashboard')}
              />
            )}

            {activeView === 'multiplayer' && (
              <MultiplayerHub
                currentUser={currentUser}
                onStartGame={(gameType, roomId) =>
                  handleNavigate(gameType === 'chess' ? 'chess' : 'ttt', { roomId })
                }
                onInviteFriend={handleInviteFriend}
                friends={friends}
              />
            )}

            {activeView === 'friends' && (
              <FriendsView
                currentUser={currentUser}
                friends={friends}
                pendingRequests={pendingRequests}
                onRefresh={refreshAppData}
                onNavigateChat={(userId) => handleNavigate('chat', { targetUserId: userId })}
                onInviteGame={handleInviteFriend}
              />
            )}

            {activeView === 'leaderboard' && (
              <LeaderboardView
                currentUser={currentUser}
                leaderboard={leaderboard}
                onInviteGame={handleInviteFriend}
                onNavigateChat={(userId) => handleNavigate('chat', { targetUserId: userId })}
              />
            )}

            {activeView === 'settings' && (
              <SettingsModal
                currentUser={currentUser}
                onClose={() => handleNavigate('dashboard')}
                onLogout={handleLogout}
                onDeleteAccount={handleDeleteAccount}
                onUpdateUser={(updated) => setCurrentUser(updated)}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <Suspense fallback={null}>
          <ProfileModal
            currentUser={currentUser}
            onClose={() => setShowProfileModal(false)}
            onUpdate={(updated) => setCurrentUser(updated)}
          />
        </Suspense>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <Suspense fallback={null}>
          <SettingsModal
            currentUser={currentUser}
            onClose={() => setShowSettingsModal(false)}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
            onUpdateUser={(updated) => setCurrentUser(updated)}
          />
        </Suspense>
      )}
    </div>
  );
}
