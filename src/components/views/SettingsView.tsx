import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Lock,
  LogOut,
  MailCheck,
  Moon,
  Shield,
  Sun,
  Trash2,
  User,
  Volume2,
  X,
} from 'lucide-react';
import { useArena } from '../../context/ArenaContext';

export function SettingsView() {
  const {
    player,
    isGuestPractice,
    setActiveNav,
    updatePreferences,
    changePassword,
    resendVerification,
    logout,
    submitDeletionRequest,
    pushToast,
  } = useArena();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!player) return null;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (!currentPw || newPw.length < 6) {
      setPwError('Enter your current password and a new password of at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeletionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    try {
      await submitDeletionRequest(deleteReason);
      setDeleteModalOpen(false);
      setDeleteReason('');
    } catch (err) {
      pushToast({
        tone: 'danger',
        title: 'Request Failed',
        message: err instanceof Error ? err.message : 'Could not log deletion request.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-ink">Account & Arena Settings</h2>
        <p className="text-sm text-muted mt-0.5">
          Manage your security credentials, privacy controls, audio feedback, and visual theme.
        </p>
      </div>

      {/* Quick Profile & Email Verification */}
      <section className="arena-surface rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-[#8B5CF6] mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="font-display text-base font-bold text-ink">Profile & Verification</h3>
            <p className="text-xs text-muted mt-0.5">
              {player.email} ·{' '}
              {player.emailVerified ? (
                <span className="text-[#22C55E] font-semibold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Email Verified
                </span>
              ) : (
                <span className="text-amber-400 font-semibold">Verification Pending</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!player.emailVerified && !isGuestPractice && (
            <button
              type="button"
              onClick={resendVerification}
              className="h-9 px-3.5 rounded-xl bg-panel border border-line text-xs font-semibold text-[#22D3EE] inline-flex items-center gap-1.5"
            >
              <MailCheck className="w-3.5 h-3.5" />
              <span>Resend Verification</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveNav('profile')}
            className="h-9 px-4 rounded-xl bg-panel border border-line text-xs font-semibold text-ink hover:border-[#8B5CF6]/50"
          >
            Edit Profile
          </button>
        </div>
      </section>

      {/* Appearance & Audio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="arena-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            {player.theme === 'dark' ? (
              <Moon className="w-4 h-4 text-[#8B5CF6]" aria-hidden="true" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
            )}
            <h3 className="font-display text-base font-bold text-ink">Theme Preference</h3>
          </div>
          <p className="text-xs text-muted">Choose your preferred arena contrast surface.</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updatePreferences({ theme: 'dark' })}
              className={`h-11 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 ${
                player.theme === 'dark'
                  ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-ink'
                  : 'border-line bg-panel text-muted hover:text-ink'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Dark Arena</span>
            </button>
            <button
              type="button"
              onClick={() => updatePreferences({ theme: 'light' })}
              className={`h-11 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 ${
                player.theme === 'light'
                  ? 'border-[#8B5CF6] bg-[#8B5CF6]/15 text-ink'
                  : 'border-line bg-panel text-muted hover:text-ink'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Light Arena</span>
            </button>
          </div>
        </section>

        <section className="arena-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#22D3EE]" aria-hidden="true" />
              <h3 className="font-display text-base font-bold text-ink">Sound Effects</h3>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={player.soundPrefs.enabled}
              aria-label="Toggle arena sound effects"
              onClick={() =>
                updatePreferences({
                  soundPrefs: { ...player.soundPrefs, enabled: !player.soundPrefs.enabled },
                })
              }
              className={`w-11 h-6 rounded-full transition-colors p-0.5 ${
                player.soundPrefs.enabled ? 'bg-[#8B5CF6]' : 'bg-panel border border-line'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  player.soundPrefs.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted">
              <label htmlFor="sound-volume">Effects Volume</label>
              <span className="font-mono tabular-nums">{Math.round(player.soundPrefs.volume * 100)}%</span>
            </div>
            <input
              id="sound-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              disabled={!player.soundPrefs.enabled}
              value={player.soundPrefs.volume}
              onChange={(e) =>
                updatePreferences({
                  soundPrefs: { ...player.soundPrefs, volume: Number(e.target.value) },
                })
              }
              className="w-full accent-[#8B5CF6]"
            />
          </div>
        </section>
      </div>

      {/* Notification & Privacy Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="arena-surface rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#8B5CF6]" aria-hidden="true" />
            <h3 className="font-display text-base font-bold text-ink">Notification Preferences</h3>
          </div>
          {(
            [
              ['friendRequests', 'Friend Requests'],
              ['roomInvites', 'Room & Game Invitations'],
              ['announcements', 'Platform Announcements'],
              ['tournaments', 'Tournament Updates'],
              ['rewards', 'Reward & Milestone Alerts'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <span className="text-sm text-ink">{label}</span>
              <input
                type="checkbox"
                checked={player.notificationPrefs[key]}
                onChange={(e) =>
                  updatePreferences({
                    notificationPrefs: {
                      ...player.notificationPrefs,
                      [key]: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 accent-[#8B5CF6] rounded"
              />
            </label>
          ))}
        </section>

        <section className="arena-surface rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#22D3EE]" aria-hidden="true" />
            <h3 className="font-display text-base font-bold text-ink">Privacy Controls</h3>
          </div>
          {(
            [
              ['showOnlineStatus', 'Display Real-Time Online Presence'],
              ['allowFriendRequests', 'Allow Incoming Friend Requests'],
              ['allowRoomInvites', 'Allow Room Invitations from Friends'],
              ['publicProfile', 'Show Public Profile in Search'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 py-1 cursor-pointer">
              <span className="text-sm text-ink">{label}</span>
              <input
                type="checkbox"
                checked={player.privacyPrefs[key]}
                onChange={(e) =>
                  updatePreferences({
                    privacyPrefs: {
                      ...player.privacyPrefs,
                      [key]: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 accent-[#22D3EE] rounded"
              />
            </label>
          ))}
        </section>
      </div>

      {/* Change Password */}
      <section className="arena-surface rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#8B5CF6]" aria-hidden="true" />
          <h3 className="font-display text-base font-bold text-ink">Change Account Password</h3>
        </div>
        {pwError && (
          <p role="alert" className="text-xs text-[#EF4444]">
            {pwError}
          </p>
        )}
        <form onSubmit={handlePasswordChange} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="pw-current" className="block text-xs font-medium text-muted mb-1">
              Current Password
            </label>
            <input
              id="pw-current"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>
          <div>
            <label htmlFor="pw-new" className="block text-xs font-medium text-muted mb-1">
              New Password
            </label>
            <input
              id="pw-new"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="block text-xs font-medium text-muted mb-1">
              Confirm New Password
            </label>
            <input
              id="pw-confirm"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={pwSaving}
              className="arena-gradient-btn h-10 px-5 rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              {pwSaving ? 'Updating Password...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      {/* Session & Account Deletion Request */}
      <section className="arena-surface rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-bold text-ink">Session & Account Management</h3>
          <p className="text-xs text-muted mt-0.5">
            {player.deletionRequestedAt
              ? `Account deletion request logged on ${new Date(player.deletionRequestedAt).toLocaleDateString()}.`
              : 'Sign out of this device or submit a verified account deletion request.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={logout}
            className="h-10 px-4 rounded-xl bg-panel border border-line text-xs font-semibold text-ink hover:border-[#8B5CF6]/50 inline-flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>{isGuestPractice ? 'Exit Practice' : 'Sign Out'}</span>
          </button>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="h-10 px-4 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/20 inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>Request Account Deletion</span>
          </button>
        </div>
      </section>

      {/* Brand Footer Credit inside Settings */}
      <p className="text-xs text-muted pt-2">BWB ARENA · PLAY TOGETHER. COMPETE FOREVER. · CREATED BY SATYAM (BWB)</p>

      {/* Account Deletion Request Modal */}
      {deleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Request account deletion"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form onSubmit={handleDeletionSubmit} className="arena-surface rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-lg font-bold text-ink">Request Account Deletion</h4>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                aria-label="Cancel account deletion"
                className="p-1 text-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Submitting this request queues permanent removal of your BWB ARENA profile, username reservation, and
              match records through our administrative operations queue.
            </p>
            <div>
              <label htmlFor="delete-reason" className="block text-xs font-medium text-muted mb-1.5">
                Optional Reason
              </label>
              <textarea
                id="delete-reason"
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Tell us why you are leaving..."
                className="w-full p-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#EF4444]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 h-10 rounded-xl border border-line text-xs font-semibold text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={deleting}
                className="flex-1 h-10 rounded-xl bg-[#EF4444] text-white text-xs font-semibold hover:brightness-110 disabled:opacity-50"
              >
                {deleting ? 'Submitting...' : 'Confirm Request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
