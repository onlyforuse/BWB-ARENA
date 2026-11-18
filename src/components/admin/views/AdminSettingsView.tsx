import React, { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import { validatePlatformSettingsPatch } from '../../../lib/adminRules';
import type { PlatformSettings } from '../../../types/arena';

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  danger?: boolean;
  onChange: (next: boolean) => void;
}

function SettingToggleRow({ id, label, description, checked, danger, onChange }: ToggleRowProps) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-semibold text-ink cursor-pointer">
          {label}
        </label>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
          checked ? (danger ? 'bg-amber-500' : 'bg-[#8B5CF6]') : 'bg-panel border border-line'
        }`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export function AdminSettingsView() {
  const { platformSettings, savePlatformSettings } = useAdmin();
  const [draft, setDraft] = useState<PlatformSettings>(platformSettings);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(platformSettings);
  }, [platformSettings]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(platformSettings);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const check = validatePlatformSettingsPatch(draft);
    if (!check.valid) {
      setError(check.error || 'Please review your platform settings.');
      return;
    }
    setBusy(true);
    try {
      await savePlatformSettings(check.normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save platform settings.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Global Platform Settings</h2>
          <p className="text-xs text-muted mt-0.5">
            Changes sync instantly to <code className="font-mono text-ink">/platformSettings</code> and govern the live Player Panel.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasChanges && (
            <button
              type="button"
              onClick={() => {
                setDraft(platformSettings);
                setError('');
              }}
              className="h-10 px-3.5 rounded-xl border border-line text-xs font-medium text-muted hover:text-ink inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !hasChanges}
            className="h-10 px-5 rounded-xl arena-gradient-btn text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{busy ? 'Saving...' : 'Save Platform Settings'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {draft.maintenanceMode && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-amber-300">Maintenance Mode Active</p>
            <p className="text-muted">
              Normal players visiting <code className="font-mono text-ink">/</code> will see the scheduled maintenance
              screen until this toggle is switched off.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Access Switches */}
        <section className="lg:col-span-7 arena-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#22D3EE]" />
            <h3 className="font-display text-base font-bold text-ink">Operational Feature Switches</h3>
          </div>

          <div className="divide-y divide-line">
            <SettingToggleRow
              id="switch-maintenance"
              label="Maintenance Mode"
              description="Temporarily pause player access on / while keeping /admin accessible."
              checked={draft.maintenanceMode}
              danger
              onChange={(v) => setDraft({ ...draft, maintenanceMode: v })}
            />
            <SettingToggleRow
              id="switch-registration"
              label="Allow New Registrations"
              description="Permit new accounts to claim @usernames and register via Firebase Auth."
              checked={draft.registrationEnabled}
              onChange={(v) => setDraft({ ...draft, registrationEnabled: v })}
            />
            <SettingToggleRow
              id="switch-login"
              label="Allow Player Login"
              description="Enable existing player accounts to sign in to the Player Panel."
              checked={draft.loginEnabled}
              onChange={(v) => setDraft({ ...draft, loginEnabled: v })}
            />
            <SettingToggleRow
              id="switch-public-rooms"
              label="Public Multiplayer Lobbies"
              description="Allow players to create discoverable public rooms (private code rooms stay open)."
              checked={draft.publicRoomsEnabled}
              onChange={(v) => setDraft({ ...draft, publicRoomsEnabled: v })}
            />
            <SettingToggleRow
              id="switch-chat"
              label="Global Room Chat"
              description="Allow live messaging inside multiplayer lobbies (enforced in database rules too)."
              checked={draft.chatEnabled}
              onChange={(v) => setDraft({ ...draft, chatEnabled: v })}
            />
            <SettingToggleRow
              id="switch-notifs"
              label="System Notifications"
              description="Deliver real-time tournament alerts, invites, and reward notifications."
              checked={draft.notificationsEnabled}
              onChange={(v) => setDraft({ ...draft, notificationsEnabled: v })}
            />
          </div>
        </section>

        {/* Branding & Limits */}
        <section className="lg:col-span-5 arena-surface rounded-2xl p-5 space-y-4">
          <h3 className="font-display text-base font-bold text-ink">Branding & Capacity Limits</h3>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="set-platform-name" className="block text-xs text-muted">
                Platform Display Name
              </label>
              <input
                id="set-platform-name"
                type="text"
                value={draft.platformName}
                onChange={(e) => setDraft({ ...draft, platformName: e.target.value })}
                className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="set-tagline" className="block text-xs text-muted">
                Tagline
              </label>
              <input
                id="set-tagline"
                type="text"
                value={draft.tagline}
                onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
                className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="set-welcome" className="block text-xs text-muted">
                Dashboard Welcome Copy
              </label>
              <textarea
                id="set-welcome"
                rows={3}
                value={draft.welcomeMessage}
                onChange={(e) => setDraft({ ...draft, welcomeMessage: e.target.value })}
                className="w-full p-3.5 rounded-xl bg-panel border border-line text-xs text-ink focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <label htmlFor="set-max-room" className="block text-xs text-muted">
                  Max Room Capacity (2–8)
                </label>
                <input
                  id="set-max-room"
                  type="number"
                  min={2}
                  max={8}
                  value={draft.maxRoomCapacity}
                  onChange={(e) => setDraft({ ...draft, maxRoomCapacity: Number(e.target.value) })}
                  className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm font-mono text-ink tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="set-chat-rate" className="block text-xs text-muted">
                  Chat Cooldown (ms)
                </label>
                <input
                  id="set-chat-rate"
                  type="number"
                  min={250}
                  max={15000}
                  step={50}
                  value={draft.chatRateLimitMs}
                  onChange={(e) => setDraft({ ...draft, chatRateLimitMs: Number(e.target.value) })}
                  className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm font-mono text-ink tabular-nums"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
