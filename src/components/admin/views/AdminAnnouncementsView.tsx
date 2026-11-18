import React, { useState } from 'react';
import { Bell, Megaphone, Pencil, Pin, Send, Trash2, X } from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import { validateAnnouncementDraft } from '../../../lib/adminRules';
import type { PlatformAnnouncement } from '../../../types/arena';

export function AdminAnnouncementsView() {
  const { announcements, users, saveAnnouncement, deleteAnnouncement, broadcastNotification } = useAdmin();

  // Announcement composer state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(true);
  const [breaking, setBreaking] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // Direct Broadcast notification state
  const [audience, setAudience] = useState<'active' | 'online' | 'single'>('active');
  const [singleUid, setSingleUid] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastError, setBroadcastError] = useState('');
  const [broadcastBusy, setBroadcastBusy] = useState(false);

  const resetComposer = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setPinned(true);
    setBreaking(false);
    setFormError('');
  };

  const startEdit = (item: PlatformAnnouncement) => {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setPinned(Boolean(item.pinned));
    setBreaking(Boolean(item.breaking));
    setFormError('');
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const check = validateAnnouncementDraft({ title, body });
    if (!check.valid) {
      setFormError(check.error || 'Complete the required announcement fields.');
      return;
    }
    setBusy(true);
    try {
      const existing = editingId ? announcements.find((a) => a.id === editingId) : undefined;
      await saveAnnouncement({
        id: editingId || undefined,
        createdAt: existing?.createdAt,
        title: title.trim(),
        body: body.trim(),
        pinned,
        breaking,
        authorLabel: 'BWB ARENA HQ',
      });
      resetComposer();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to publish announcement.');
    } finally {
      setBusy(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastError('');
    if (broadcastTitle.trim().length < 3 || broadcastBody.trim().length < 6) {
      setBroadcastError('Enter a notification title (3+ chars) and message (6+ chars).');
      return;
    }

    let targetUids: string[] = [];
    if (audience === 'active') {
      targetUids = users.filter((u) => u.status === 'active').map((u) => u.uid);
    } else if (audience === 'online') {
      targetUids = users.filter((u) => u.online && u.status === 'active').map((u) => u.uid);
    } else if (singleUid) {
      targetUids = [singleUid];
    }

    if (targetUids.length === 0) {
      setBroadcastError('No eligible players match the selected audience.');
      return;
    }

    setBroadcastBusy(true);
    try {
      await broadcastNotification(targetUids, {
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
      });
      setBroadcastTitle('');
      setBroadcastBody('');
    } catch (err) {
      setBroadcastError(err instanceof Error ? err.message : 'Broadcast failed.');
    } finally {
      setBroadcastBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">Announcements & System Broadcasts</h2>
        <p className="text-xs text-muted mt-0.5">
          Publish updates directly to the Player Panel Home Dashboard or dispatch targeted inbox notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Announcement Composer */}
        <form onSubmit={handlePublish} className="lg:col-span-6 arena-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#8B5CF6]" />
              <h3 className="font-display text-base font-bold text-ink">
                {editingId ? 'Edit Announcement' : 'Publish Platform Announcement'}
              </h3>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetComposer}
                className="text-xs text-muted hover:text-ink inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Edit</span>
              </button>
            )}
          </div>

          {formError && (
            <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-300">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="ann-title" className="block text-xs text-muted">
              Headline
            </label>
            <input
              id="ann-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Season 02 Championship Qualifiers Open"
              className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ann-body" className="block text-xs text-muted">
              Announcement Body
            </label>
            <textarea
              id="ann-body"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write clear, concise details shown on the player dashboard..."
              className="w-full p-3.5 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-ink">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="rounded border-line accent-[#8B5CF6]"
              />
              <span>Pin to top of Home Feed</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={breaking}
                onChange={(e) => setBreaking(e.target.checked)}
                className="rounded border-line accent-[#8B5CF6]"
              />
              <span>Highlight as Priority Notice</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="h-10 px-5 rounded-xl arena-gradient-btn text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{editingId ? 'Save Announcement' : 'Publish Announcement'}</span>
          </button>
        </form>

        {/* System Notification Broadcaster */}
        <form onSubmit={handleBroadcast} className="lg:col-span-6 arena-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#22D3EE]" />
            <h3 className="font-display text-base font-bold text-ink">Broadcast Player Notification</h3>
          </div>

          {broadcastError && (
            <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-300">
              {broadcastError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="broadcast-audience" className="block text-xs text-muted">
                Target Audience
              </label>
              <select
                id="broadcast-audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value as 'active' | 'online' | 'single')}
                className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-xs text-ink focus:outline-none focus:border-[#8B5CF6]"
              >
                <option value="active">All Active Players ({users.filter((u) => u.status === 'active').length})</option>
                <option value="online">
                  Online Players Only ({users.filter((u) => u.online && u.status === 'active').length})
                </option>
                <option value="single">Single Specific Player</option>
              </select>
            </div>

            {audience === 'single' && (
              <div className="space-y-1.5">
                <label htmlFor="broadcast-player" className="block text-xs text-muted">
                  Select Player
                </label>
                <select
                  id="broadcast-player"
                  value={singleUid}
                  onChange={(e) => setSingleUid(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-xs text-ink focus:outline-none focus:border-[#8B5CF6]"
                >
                  <option value="">Choose player...</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      @{u.username} ({u.displayName})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="broadcast-title" className="block text-xs text-muted">
              Notification Title
            </label>
            <input
              id="broadcast-title"
              type="text"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="Double XP Weekend Active"
              className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="broadcast-body" className="block text-xs text-muted">
              Message
            </label>
            <textarea
              id="broadcast-body"
              rows={3}
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="All multiplayer matches award bonus XP through Sunday midnight."
              className="w-full p-3.5 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <button
            type="submit"
            disabled={broadcastBusy}
            className="h-10 px-5 rounded-xl bg-surface-elevated border border-line hover:border-[#22D3EE]/55 text-xs font-semibold text-ink inline-flex items-center gap-1.5 transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-[#22D3EE]" />
            <span>Send Notification Broadcast</span>
          </button>
        </form>
      </div>

      {/* Published Announcements List */}
      <section className="arena-surface rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">Active Announcements ({announcements.length})</h3>
        </div>

        {announcements.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center">No announcements published yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {announcements.map((item) => (
              <article key={item.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted">
                    {item.pinned && (
                      <span className="inline-flex items-center gap-1 text-[#22D3EE] font-semibold">
                        <Pin className="w-3 h-3" />
                        Pinned
                      </span>
                    )}
                    {item.breaking && <span className="text-amber-400 font-semibold">Priority</span>}
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>{item.authorLabel || 'BWB ARENA HQ'}</span>
                  </div>
                  <h4 className="font-display text-base font-bold text-ink">{item.title}</h4>
                  <p className="text-xs text-muted leading-relaxed">{item.body}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    aria-label={`Edit announcement ${item.title}`}
                    className="h-8 px-3 rounded-lg bg-surface-elevated border border-line text-xs font-medium text-ink hover:border-[#8B5CF6]/50 inline-flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteAnnouncement(item)}
                    aria-label={`Delete announcement ${item.title}`}
                    className="h-8 px-3 rounded-lg border border-red-500/30 text-xs font-medium text-red-300 hover:bg-red-500/15 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
