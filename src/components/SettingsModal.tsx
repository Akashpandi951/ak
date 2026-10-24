import React, { useState } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  Eye,
  Shield,
  LogOut,
  Trash2,
  AlertTriangle,
  User,
  Lock,
  Gamepad2,
  Check,
} from 'lucide-react';
import { UserProfile } from '../types/index.ts';
import { api } from '../services/api.ts';

interface SettingsModalProps {
  currentUser: UserProfile;
  onClose: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onUpdateUser: (user: UserProfile) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  onClose,
  onLogout,
  onDeleteAccount,
  onUpdateUser,
}) => {
  const [activeTab, setActiveTab] = useState<'account' | 'privacy' | 'game'>('account');
  const [newUsername, setNewUsername] = useState(currentUser.username);
  const [statusMessage, setStatusMessage] = useState(currentUser.status_message || '');
  const [newPassword, setNewPassword] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  const [showOnline, setShowOnline] = useState(
    currentUser.privacy_settings?.show_online ?? true
  );
  const [allowInvites, setAllowInvites] = useState(
    currentUser.privacy_settings?.allow_invites ?? true
  );
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [graphicsPreset, setGraphicsPreset] = useState<'performance' | 'balanced' | 'quality'>('quality');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    try {
      const payload: {
        status_message?: string;
        new_username?: string;
        new_password?: string;
      } = {
        status_message: statusMessage,
      };
      if (newUsername.trim() && newUsername.trim() !== currentUser.username) {
        payload.new_username = newUsername.trim();
      }
      if (newPassword.trim()) {
        payload.new_password = newPassword.trim();
      }
      const res = await api.updateProfile(payload);
      onUpdateUser(res.user);
      setNewPassword('');
      setSaveSuccess('Account settings saved successfully');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update account');
    }
  };

  const handleToggleOnline = async () => {
    const newVal = !showOnline;
    setShowOnline(newVal);
    try {
      const res = await api.updateProfile({
        privacy_settings: { show_online: newVal, allow_invites: allowInvites },
      });
      onUpdateUser(res.user);
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleToggleInvites = async () => {
    const newVal = !allowInvites;
    setAllowInvites(newVal);
    try {
      const res = await api.updateProfile({
        privacy_settings: { show_online: showOnline, allow_invites: newVal },
      });
      onUpdateUser(res.user);
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteInput !== currentUser.username) return;
    setIsDeleting(true);
    try {
      await api.deleteAccount();
      onDeleteAccount();
    } catch (err) {
      console.error('Failed to delete account:', err);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0b1121] border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#070b14] border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Settings & Account</h3>
              <p className="text-xs text-slate-400">
                UID: <span className="font-mono text-cyan-400 font-bold">{currentUser.public_uid}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body with left tabs & right content */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-y-auto">
          {/* Sub-navigation */}
          <div className="sm:w-48 bg-[#080d1a] border-b sm:border-b-0 sm:border-r border-slate-800/80 p-3 flex sm:flex-col gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('account')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'account'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              Account
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'privacy'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Shield className="w-4 h-4" />
              Privacy
            </button>
            <button
              onClick={() => setActiveTab('game')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'game'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              Game Settings
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-5 sm:p-6 space-y-5 overflow-y-auto">
            {activeTab === 'account' && (
              <form onSubmit={handleSaveAccount} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Change Username
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      New Password (Optional)
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave blank to keep"
                        className="w-full h-10 pl-8 pr-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Player Bio / Status Message
                  </label>
                  <input
                    type="text"
                    value={statusMessage}
                    onChange={(e) => setStatusMessage(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {saveSuccess && (
                  <p className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    {saveSuccess}
                  </p>
                )}
                {saveError && (
                  <p className="text-xs text-rose-400 font-bold">{saveError}</p>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition-all"
                  >
                    Save Account Changes
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 border border-amber-500/30 hover:border-amber-400 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Eye className="w-5 h-5 text-cyan-400" />
                    <div>
                      <p className="font-bold text-slate-200 text-xs">Show Online Status</p>
                      <p className="text-[11px] text-slate-500">Allow friends to see when you are online</p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleOnline}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      showOnline ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        showOnline ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-cyan-400" />
                    <div>
                      <p className="font-bold text-slate-200 text-xs">Allow Game Invitations</p>
                      <p className="text-[11px] text-slate-500">Receive real-time 3D Chess & Tic-Tac-Toe invites</p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleInvites}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      allowInvites ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        allowInvites ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'game' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-3">
                    {soundEnabled ? (
                      <Volume2 className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-slate-500" />
                    )}
                    <div>
                      <p className="font-bold text-slate-200 text-xs">Sound Effects & Move Audio</p>
                      <p className="text-[11px] text-slate-500">Synthesized 3D board & victory sound effects</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      soundEnabled ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        soundEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <p className="text-xs font-bold text-slate-200">Default 3D Graphics Quality</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['performance', 'balanced', 'quality'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setGraphicsPreset(preset)}
                        className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                          graphicsPreset === preset
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Danger Zone Card — Always visible in Settings as in Reference Image 3 */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/50 via-[#1a0b16] to-rose-950/30 border border-rose-500/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-rose-300">
                      Danger Zone — Delete Account
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Deleting your account is permanent. All games, chats, and friend data will be removed.
                    </p>
                  </div>
                </div>
                {!showDeleteConfirm && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black whitespace-nowrap shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Account
                  </button>
                )}
              </div>

              {showDeleteConfirm && (
                <div className="pt-2 border-t border-rose-500/30 space-y-2.5 text-xs">
                  <p className="text-slate-300">
                    Type your username <strong className="text-white">{currentUser.username}</strong> to permanently delete your account:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      placeholder={currentUser.username}
                      className="flex-1 h-9 px-3 bg-slate-950 border border-rose-500/40 rounded-xl text-white placeholder-slate-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={deleteInput !== currentUser.username || isDeleting}
                      className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-500 transition-colors disabled:opacity-40"
                    >
                      {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
