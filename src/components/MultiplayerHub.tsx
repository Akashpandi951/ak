import React, { useState } from 'react';
import {
  Users,
  Crown,
  Grid3X3,
  Copy,
  Check,
  ArrowRight,
  Shield,
  Zap,
} from 'lucide-react';
import { UserProfile, GameRoom } from '../types/index.ts';
import { api } from '../services/api.ts';

interface MultiplayerHubProps {
  currentUser: UserProfile;
  onStartGame: (gameType: 'chess' | 'ttt', roomId: string) => void;
  onInviteFriend: (targetUserId: string, gameType: 'chess' | 'ttt') => void;
  friends: UserProfile[];
}

export const MultiplayerHub: React.FC<MultiplayerHubProps> = ({
  onStartGame,
  onInviteFriend,
  friends,
}) => {
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<2 | 3>(2);
  const [createdRoom, setCreatedRoom] = useState<GameRoom | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [inviteUidInput, setInviteUidInput] = useState('');
  const [inviteGameType, setInviteGameType] = useState<'chess' | 'ttt'>('chess');

  const handleCreateRoom = async (gameType: 'chess' | 'ttt', playersCount: 2 | 3 = maxPlayers) => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await api.createRoom(gameType, 'online', playersCount);
      setCreatedRoom(res.room);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await api.joinRoom(roomCode.trim().toUpperCase());
      onStartGame(res.room.game_type, res.room.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Room not found with that code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteByUid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUidInput.trim()) return;
    onInviteFriend(inviteUidInput.trim(), inviteGameType);
    setInviteUidInput('');
  };

  const handleCopyCode = () => {
    if (createdRoom) {
      navigator.clipboard.writeText(createdRoom.room_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
          <Users className="w-3.5 h-3.5 text-cyan-400" />
          <span>Real-Time Online Synchronization (2-Player & 3-Player Rooms)</span>
        </div>
        <h2 className="text-3xl font-black text-white">Multiplayer Matchmaking Arena</h2>
        <p className="text-xs text-slate-400">
          Create a private synchronized 2-player or 3-player room, invite a player by UID, or join with a room code.
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-2xl text-xs text-rose-300 text-center">
          {errorMessage}
        </div>
      )}

      {/* Created Room Waiting Dialog */}
      {createdRoom && (
        <div className="p-6 bg-slate-900 border border-cyan-400 rounded-3xl shadow-2xl text-center space-y-4 animate-in fade-in zoom-in">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400">
            {createdRoom.game_type === 'chess' ? <Crown className="w-8 h-8" /> : <Grid3X3 className="w-8 h-8" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Private {createdRoom.max_players === 3 ? '3-Player ' : '2-Player '}
              {createdRoom.game_type === 'chess' ? '3D Chess' : 'Tic-Tac-Toe'} Room Created!
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Share this room code with authorized participants or enter the room now:
            </p>
          </div>

          <div
            onClick={handleCopyCode}
            className="inline-flex items-center gap-3 px-6 py-3 bg-slate-950 border-2 border-dashed border-cyan-400 rounded-2xl cursor-pointer hover:bg-slate-950/80 transition-colors"
          >
            <span className="font-mono text-2xl font-black text-cyan-300 tracking-wider">
              {createdRoom.room_code}
            </span>
            {copiedCode ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-slate-400" />}
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => onStartGame(createdRoom.game_type, createdRoom.id)}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold text-xs rounded-xl hover:brightness-110 flex items-center gap-2"
            >
              Enter Match Room
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCreatedRoom(null)}
              className="px-4 py-2.5 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Two Pillars: Create Room vs Join Room */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Private Match */}
        <div className="p-6 bg-slate-900/80 border border-cyan-500/30 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Host a Private Match</h3>
                <p className="text-xs text-slate-400">Generate an authoritative game room</p>
              </div>
            </div>

            {/* 2-Player / 3-Player Room Capacity Selector */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              {([2, 3] as const).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setMaxPlayers(cnt)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    maxPlayers === cnt
                      ? 'bg-cyan-500 text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cnt}P Room
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Select your game to create a dedicated {maxPlayers}-player room ID with synchronized chat:
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => handleCreateRoom('chess', maxPlayers)}
              disabled={isLoading}
              className="p-4 bg-slate-950 border border-cyan-500/30 hover:border-cyan-400 rounded-2xl flex flex-col items-center text-center gap-2 group transition-all"
            >
              <Crown className="w-7 h-7 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-slate-100">
                Host {maxPlayers}P 3D Chess
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">10 min clock</span>
            </button>

            <button
              onClick={() => handleCreateRoom('ttt', maxPlayers)}
              disabled={isLoading}
              className="p-4 bg-slate-950 border border-violet-500/30 hover:border-violet-400 rounded-2xl flex flex-col items-center text-center gap-2 group transition-all"
            >
              <Grid3X3 className="w-7 h-7 text-violet-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-slate-100">
                Host {maxPlayers}P Tic-Tac-Toe
              </span>
              <span className="text-[10px] text-violet-400 font-mono">Fast 3x3 Grid</span>
            </button>
          </div>
        </div>

        {/* Join by Code or Direct UID Invite */}
        <div className="p-6 bg-slate-900/80 border border-cyan-500/30 rounded-3xl shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Join Room or Invite by UID</h3>
                <p className="text-xs text-slate-400">Enter room code or player UID</p>
              </div>
            </div>

            <form onSubmit={handleJoinByCode} className="flex gap-2">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Room Code (e.g. 7A8F32)"
                className="flex-1 h-10 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono uppercase text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={!roomCode.trim() || isLoading}
                className="px-4 h-10 bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold text-xs rounded-xl hover:brightness-110 transition-all disabled:opacity-40"
              >
                Join Room
              </button>
            </form>

            <form onSubmit={handleInviteByUid} className="flex gap-2 pt-1 border-t border-slate-800/80">
              <input
                type="text"
                value={inviteUidInput}
                onChange={(e) => setInviteUidInput(e.target.value)}
                placeholder="Invite by UID or Username..."
                className="flex-1 h-10 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <select
                value={inviteGameType}
                onChange={(e) => setInviteGameType(e.target.value as 'chess' | 'ttt')}
                className="h-10 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-cyan-300 font-bold focus:outline-none"
              >
                <option value="chess">Chess</option>
                <option value="ttt">TTT</option>
              </select>
              <button
                type="submit"
                disabled={!inviteUidInput.trim()}
                className="px-4 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xs rounded-xl hover:brightness-110 transition-all disabled:opacity-40"
              >
                Send Invite
              </button>
            </form>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>Strict room-based access control: only authorized room members can read or send messages.</span>
          </div>
        </div>
      </div>

      {/* Online Friends Direct Challenge Bar */}
      <div className="p-6 bg-slate-900/80 border border-cyan-500/20 rounded-3xl shadow-xl">
        <h3 className="font-bold text-sm text-slate-200 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          Direct Challenge Friends
        </h3>

        {friends.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            You haven't added any friends yet. Search other players using their username or UID to add them!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <img
                      src={friend.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.username}`}
                      alt={friend.username}
                      className="w-9 h-9 rounded-full object-cover border border-slate-700"
                    />
                    {friend.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-slate-950 rounded-full" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-100">{friend.username}</p>
                    <p className="text-[10px] text-cyan-400 font-mono">{friend.public_uid}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onInviteFriend(friend.id, 'chess')}
                    className="p-1.5 bg-cyan-500/20 hover:bg-cyan-500 hover:text-black text-cyan-300 rounded-lg text-xs transition-colors"
                    title="Invite to 3D Chess"
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onInviteFriend(friend.id, 'ttt')}
                    className="p-1.5 bg-violet-500/20 hover:bg-violet-500 hover:text-white text-violet-300 rounded-lg text-xs transition-colors"
                    title="Invite to Tic-Tac-Toe"
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
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
