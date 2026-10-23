/**
 * ChessVerse 3D - Full-Stack Gaming Platform Master Component
 */
import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, GameInvitation, Conversation, MatchHistoryItem } from './types/index.ts';
import { api, getAuthToken, clearAuthToken, wsService } from './services/api.ts';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { HomeDashboard } from './components/HomeDashboard.tsx';
import { Chess3DGame } from './components/Chess3DGame.tsx';
import { TicTacToeGame } from './components/TicTacToeGame.tsx';
import { WhatsAppChat } from './components/WhatsAppChat.tsx';
import { MultiplayerHub } from './components/MultiplayerHub.tsx';
import { FriendsView } from './components/FriendsView.tsx';
import { LeaderboardView } from './components/LeaderboardView.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';

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
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ chess: UserProfile[]; ttt: UserProfile[] }>({
    chess: [],
    ttt: [],
  });
  const [onlineCount] = useState<number>(6);

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
      refreshAppData();
    }
  }, [currentUser?.id, refreshAppData]);

  // WebSocket global real-time event listeners
  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubs = [
      wsService.on('game_invitation', (data: any) => {
        if (data.invitation) {
          setInvitations((prev) => [data.invitation, ...prev]);
        }
      }),

      wsService.on('invitation_accepted', (data: any) => {
        const gameType = data.gameType || 'chess';
        handleNavigate(gameType === 'chess' ? 'chess' : 'ttt', { roomId: data.roomId });
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
      const res = await api.respondInvitation(inv.id, 'accept');
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      handleNavigate(inv.game_type === 'chess' ? 'chess' : 'ttt', { roomId: res.roomId });
    } catch (err: any) {
      showToast(err.message || 'Failed to accept invitation');
    }
  };

  const handleDeclineInvitation = async (inv: GameInvitation) => {
    try {
      await api.respondInvitation(inv.id, 'decline');
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (err) {
      console.error('Failed to decline invitation:', err);
    }
  };

  const handleInviteFriend = async (targetUserId: string, gameType: 'chess' | 'ttt') => {
    try {
      const res = await api.sendInvitation(targetUserId, gameType);
      handleNavigate(gameType === 'chess' ? 'chess' : 'ttt', { roomId: res.room.id });
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
    setCurrentUser(null);
    setActiveView('dashboard');
  };

  const handleDeleteAccount = () => {
    clearAuthToken();
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
    return <AuthModal onSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#060913] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Toast notification banner */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-cyan-500/40 text-cyan-300 text-xs font-bold shadow-2xl">
          {toastMessage}
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
        </main>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onUpdate={(updated) => setCurrentUser(updated)}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setShowSettingsModal(false)}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
          onUpdateUser={(updated) => setCurrentUser(updated)}
        />
      )}
    </div>
  );
}
