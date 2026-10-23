import React, { useState } from 'react';
import {
  UserCheck,
  Search,
  UserPlus,
  Crown,
  Grid3X3,
  MessageSquare,
  Check,
  X,
  Copy,
  Sparkles,
} from 'lucide-react';
import { UserProfile } from '../types/index.ts';
import { api } from '../services/api.ts';

interface FriendsViewProps {
  currentUser: UserProfile;
  friends: UserProfile[];
  pendingRequests: any[];
  onRefresh: () => void;
  onNavigateChat: (userId: string) => void;
  onInviteGame: (userId: string, gameType: 'chess' | 'ttt') => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  currentUser,
  friends,
  pendingRequests,
  onRefresh,
  onNavigateChat,
  onInviteGame,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setActionMessage('');
    try {
      const res = await api.searchUsers(searchQuery.trim());
      setSearchResults(res.users || []);
    } catch (err: any) {
      setActionMessage(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    try {
      await api.sendFriendRequest(targetUserId);
      setActionMessage('Friend request sent successfully!');
      onRefresh();
    } catch (err: any) {
      setActionMessage(err.message || 'Could not send friend request');
    }
  };

  const handleRespond = async (friendshipId: string, action: 'accept' | 'decline') => {
    try {
      await api.respondFriendRequest(friendshipId, action);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to respond:', err);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Search Bar Banner */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-cyan-500/30 shadow-xl space-y-4">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-cyan-400" />
          Find Players by Username or UID
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by exact username or public UID (e.g. CV-7K9P2XAM)..."
            className="flex-1 h-12 px-4 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-6 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center gap-2"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {actionMessage && (
          <p className="text-xs text-cyan-300 bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-500/20">
            {actionMessage}
          </p>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="pt-2 divide-y divide-slate-800">
            {searchResults.map((user) => {
              const isAlreadyFriend = friends.some((f) => f.id === user.id);
              return (
                <div key={user.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                      alt={user.username}
                      className="w-10 h-10 rounded-full object-cover border border-slate-700"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{user.username}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                          {user.public_uid}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        Chess Rating: {user.stats?.chess?.rating || 1200}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isAlreadyFriend && (
                      <button
                        onClick={() => handleSendRequest(user.id)}
                        className="px-3 py-1.5 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-cyan-500/30"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Add Friend
                      </button>
                    )}
                    <button
                      onClick={() => onNavigateChat(user.id)}
                      className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors"
                      title="Send Message"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-pink-500/30 shadow-xl space-y-3">
          <h3 className="font-bold text-sm text-pink-300 uppercase tracking-wider">
            Pending Friend Requests ({pendingRequests.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingRequests.map((req) => (
              <div
                key={req.friendshipId}
                className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={req.requester?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.requester?.username}`}
                    alt="avatar"
                    className="w-9 h-9 rounded-full object-cover border border-slate-700"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-100">{req.requester?.username}</p>
                    <p className="text-[10px] text-cyan-400 font-mono">{req.requester?.public_uid}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleRespond(req.friendshipId, 'accept')}
                    className="p-1.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-black rounded-lg transition-colors"
                    title="Accept"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRespond(req.friendshipId, 'decline')}
                    className="p-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-black rounded-lg transition-colors"
                    title="Decline"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted Friends List */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-cyan-500/20 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-cyan-400" />
            Your Friends ({friends.length})
          </h3>
        </div>

        {friends.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">
            You don't have any friends added yet. Use the search bar above to connect with other players!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between hover:border-cyan-500/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={friend.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.username}`}
                      alt={friend.username}
                      className="w-11 h-11 rounded-full object-cover border border-slate-700"
                    />
                    {friend.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">{friend.username}</h4>
                    <span className="text-[10px] font-mono text-cyan-400">{friend.public_uid}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Chess: {friend.stats?.chess?.rating || 1200} • TTT W: {friend.stats?.ttt?.wins || 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onInviteGame(friend.id, 'chess')}
                    className="p-2 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black rounded-xl text-xs transition-colors"
                    title="Challenge to 3D Chess"
                  >
                    <Crown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onInviteGame(friend.id, 'ttt')}
                    className="p-2 bg-violet-500/20 text-violet-300 hover:bg-violet-500 hover:text-white rounded-xl text-xs transition-colors"
                    title="Challenge to Tic-Tac-Toe"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onNavigateChat(friend.id)}
                    className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs transition-colors"
                    title="Open WhatsApp Chat"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
