import React, { useEffect, useRef, useState } from 'react';
import { Flag, Send, Smile, X } from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import type { ChatMessage } from '../../types/arena';
import { Avatar } from '../common/Avatar';

const QUICK_EMOJIS = ['GG', '🔥', '🏆', '⚡', '👏', '😄', '🎯', '🚀'];

export function RoomChatPanel({ compact = false }: { compact?: boolean }) {
  const {
    player,
    activeRoom,
    roomMessages,
    platformSettings,
    sendChatMessage,
    reportMessage,
  } = useArena();

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [reportingMsg, setReportingMsg] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState('Abusive or toxic language');

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages.length]);

  if (!activeRoom || !player) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!input.trim()) return;
    setSending(true);
    try {
      await sendChatMessage(input);
      setInput('');
      setShowEmoji(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleConfirmReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingMsg) return;
    await reportMessage(reportingMsg, reportReason);
    setReportingMsg(null);
    setReportReason('Abusive or toxic language');
  };

  return (
    <section
      aria-label="Room chat"
      className={`arena-surface rounded-2xl flex flex-col overflow-hidden ${
        compact ? 'h-[420px]' : 'h-[460px] lg:h-[540px]'
      }`}
    >
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-bold text-ink">Live Room Chat</h3>
          <p className="text-[11px] text-muted tabular-nums">
            Room {activeRoom.code} · {Object.keys(activeRoom.participants).length}{' '}
            {Object.keys(activeRoom.participants).length === 1 ? 'player' : 'players'}
          </p>
        </div>
        {!platformSettings.chatEnabled && (
          <span className="text-[11px] font-medium text-[#EF4444]">Chat Paused</span>
        )}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {roomMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <p className="text-sm font-medium text-ink">No messages yet</p>
            <p className="text-xs text-muted mt-1">
              Coordinate match picks, drop a GG, or greet incoming squadmates.
            </p>
          </div>
        ) : (
          roomMessages.map((msg) => {
            const isMine = msg.senderUid === player.uid;
            const timeLabel = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={msg.id} className="group flex items-start gap-2.5">
                <Avatar
                  avatarId={msg.senderAvatarId}
                  avatarUrl={msg.senderAvatarUrl}
                  name={msg.senderUsername}
                  size="xs"
                  online={msg.senderOnline ?? true}
                  showPresence
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-xs font-semibold truncate ${
                          isMine ? 'text-[#22D3EE]' : 'text-ink'
                        }`}
                      >
                        @{msg.senderUsername}
                      </span>
                      <span className="text-[10px] font-mono text-muted tabular-nums shrink-0">
                        {timeLabel}
                      </span>
                    </div>
                    {!isMine && (
                      <button
                        type="button"
                        onClick={() => setReportingMsg(msg)}
                        aria-label={`Report message from ${msg.senderUsername}`}
                        className="opacity-70 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-muted hover:text-[#EF4444] transition-opacity"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-ink/95 break-words leading-snug mt-0.5">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Quick Emoji Picker */}
      {showEmoji && (
        <div className="px-3 py-2 border-t border-line bg-panel flex items-center gap-1.5 flex-wrap">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => setInput((prev) => `${prev}${prev ? ' ' : ''}${em}`)}
              className="h-8 px-2.5 rounded-lg bg-surface border border-line text-xs font-semibold text-ink hover:border-[#8B5CF6]/50"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="px-3.5 pt-2 text-[11px] text-[#EF4444]">
          {error}
        </p>
      )}

      {/* Composer */}
      <form onSubmit={handleSend} className="p-3 border-t border-line flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowEmoji((s) => !s)}
          aria-label="Toggle quick reactions"
          className="h-10 w-10 rounded-xl bg-panel border border-line flex items-center justify-center text-muted hover:text-ink shrink-0"
        >
          <Smile className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!platformSettings.chatEnabled || sending}
          maxLength={240}
          placeholder={platformSettings.chatEnabled ? 'Send a room message...' : 'Chat disabled'}
          aria-label="Room chat message"
          className="flex-1 h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6] min-w-0"
        />
        <button
          type="submit"
          disabled={!platformSettings.chatEnabled || sending || !input.trim()}
          aria-label="Send message"
          className="arena-gradient-btn h-10 w-10 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Report Message Modal */}
      {reportingMsg && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report chat message"
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form onSubmit={handleConfirmReport} className="arena-surface rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-base font-bold text-ink">Report Chat Message</h4>
              <button
                type="button"
                onClick={() => setReportingMsg(null)}
                aria-label="Cancel report"
                className="p-1 text-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl bg-panel border border-line p-3 text-xs">
              <p className="font-semibold text-ink">@{reportingMsg.senderUsername}</p>
              <p className="text-muted mt-1">"{reportingMsg.text}"</p>
            </div>
            <div>
              <label htmlFor="report-reason" className="block text-xs font-medium text-muted mb-1.5">
                Reason for moderation review
              </label>
              <select
                id="report-reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
              >
                <option value="Abusive or toxic language">Abusive or toxic language</option>
                <option value="Spam or flooding">Spam or flooding</option>
                <option value="Cheating or match disruption">Cheating or match disruption</option>
                <option value="Inappropriate content">Inappropriate content</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportingMsg(null)}
                className="flex-1 h-10 rounded-xl border border-line text-xs font-semibold text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 h-10 rounded-xl bg-[#EF4444] text-white text-xs font-semibold hover:brightness-110"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
