import React, { useState } from 'react';
import { X, User, Crown, Grid3X3, Copy, Check, Sparkles, Trophy, Calendar } from 'lucide-react';
import { UserProfile } from '../types/index.ts';
import { api } from '../services/api.ts';

interface ProfileModalProps {
  currentUser: UserProfile;
  onClose: () => void;
  onUpdate: (user: UserProfile) => void;
}

const PRESET_AVATARS = [
  'Grandmaster',
  'CyberKnight',
  'QuantumRook',
  'SolarQueen',
  'NeonBishop',
  'ShadowPawn',
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  currentUser,
  onClose,
  onUpdate,
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.avatar_url);
  const [copiedUid, setCopiedUid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCopyUid = () => {
    navigator.clipboard.writeText(currentUser.public_uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleSaveAvatar = async (seed: string) => {
    const newUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
    setSelectedAvatar(newUrl);
    setIsSaving(true);
    try {
      const res = await api.updateProfile({ avatar_url: newUrl });
      onUpdate(res.user);
    } catch (err) {
      console.error('Failed to update avatar:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const chessTotal =
    (currentUser.stats?.chess?.wins || 0) +
    (currentUser.stats?.chess?.losses || 0) +
    (currentUser.stats?.chess?.draws || 0);

  const tttTotal =
    (currentUser.stats?.ttt?.wins || 0) +
    (currentUser.stats?.ttt?.losses || 0) +
    (currentUser.stats?.ttt?.draws || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Card Header */}
        <div className="flex items-center gap-4">
          <img
            src={selectedAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`}
            alt={currentUser.username}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-cyan-400/60 shadow-lg shadow-cyan-500/20"
          />
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              {currentUser.username}
            </h3>
            <div
              onClick={handleCopyUid}
              className="mt-1 inline-flex items-center gap-2 px-2.5 py-1 bg-slate-950 rounded-lg border border-cyan-500/30 text-xs font-mono text-cyan-400 cursor-pointer hover:border-cyan-400 transition-colors"
            >
              <span>{currentUser.public_uid}</span>
              {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </div>
          </div>
        </div>

        {/* Avatar Preset Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
            Choose Player Avatar
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {PRESET_AVATARS.map((seed) => {
              const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
              return (
                <button
                  key={seed}
                  onClick={() => handleSaveAvatar(seed)}
                  className={`relative p-1 rounded-xl border transition-all ${
                    selectedAvatar === url
                      ? 'border-cyan-400 bg-cyan-500/20'
                      : 'border-slate-800 hover:border-slate-600 bg-slate-950'
                  }`}
                >
                  <img src={url} alt={seed} className="w-10 h-10 rounded-lg object-cover" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Match Career Records
          </h4>

          {/* Chess Stats */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Crown className="w-4 h-4 text-cyan-400" />
                3D Chess
              </span>
              <span className="font-mono text-cyan-400">
                Rating: {currentUser.stats?.chess?.rating || 1200}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500">Wins</span>
                <p className="font-bold text-emerald-400">{currentUser.stats?.chess?.wins || 0}</p>
              </div>
              <div className="p-2 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500">Losses</span>
                <p className="font-bold text-rose-400">{currentUser.stats?.chess?.losses || 0}</p>
              </div>
              <div className="p-2 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500">Draws</span>
                <p className="font-bold text-amber-400">{currentUser.stats?.chess?.draws || 0}</p>
              </div>
              <div className="p-2 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500">Total</span>
                <p className="font-bold text-slate-300">{chessTotal}</p>
              </div>
            </div>
          </div>

          {/* TTT Stats */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-violet-300">
                <Grid3X3 className="w-4 h-4 text-violet-400" />
                Tic-Tac-Toe O-L-X
              </span>
              <span className="font-mono text-violet-400">
                Total: {tttTotal}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500">Wins</span>
                <p className="font-bold text-emerald-400">{currentUser.stats?.ttt?.wins || 0}</p>
              </div>
              <div className="p-2 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500">Losses</span>
                <p className="font-bold text-rose-400">{currentUser.stats?.ttt?.losses || 0}</p>
              </div>
              <div className="p-2 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500">Draws</span>
                <p className="font-bold text-amber-400">{currentUser.stats?.ttt?.draws || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
