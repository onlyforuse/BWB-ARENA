import { useState } from 'react';
import { Award, Bell, CheckCheck, Megaphone, Swords, Trophy, Users } from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import type { ArenaNotification, NotificationCategory } from '../../types/arena';

const FILTERS: Array<{ id: 'all' | NotificationCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'room_invite', label: 'Room Invites' },
  { id: 'friend_request', label: 'Friends' },
  { id: 'reward', label: 'Rewards' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'tournament', label: 'Tournaments' },
];

export function NotificationsView() {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    joinRoomByCode,
    setActiveNav,
    pushToast,
  } = useArena();

  const [filter, setFilter] = useState<'all' | NotificationCategory>('all');

  const visible =
    filter === 'all' ? notifications : notifications.filter((n) => n.category === filter);

  const handleAction = async (n: ArenaNotification) => {
    if (!n.read) await markNotificationRead(n.id);
    if (n.actionType === 'join_room' && n.actionPayload) {
      try {
        await joinRoomByCode(n.actionPayload);
      } catch (err) {
        pushToast({
          tone: 'danger',
          title: 'Could Not Join Room',
          message: err instanceof Error ? err.message : 'Room may have closed.',
        });
      }
    } else if (n.actionType === 'view_friends') {
      setActiveNav('friends');
    } else if (n.actionType === 'view_achievements') {
      setActiveNav('achievements');
    } else if (n.actionType === 'view_games') {
      setActiveNav('games');
    }
  };

  const getIcon = (cat: NotificationCategory) => {
    switch (cat) {
      case 'friend_request':
        return Users;
      case 'room_invite':
      case 'game_invite':
        return Swords;
      case 'reward':
        return Award;
      case 'tournament':
        return Trophy;
      default:
        return Megaphone;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Notification Centre</h2>
          <p className="text-sm text-muted mt-0.5 tabular-nums">
            {unreadNotificationsCount} unread alerts across invites, rewards, and arena notices
          </p>
        </div>

        <button
          type="button"
          disabled={unreadNotificationsCount === 0}
          onClick={markAllNotificationsRead}
          className="h-10 px-4 rounded-xl bg-surface border border-line text-xs font-semibold text-ink hover:border-[#22D3EE]/50 inline-flex items-center gap-2 disabled:opacity-45 self-start sm:self-auto"
        >
          <CheckCheck className="w-4 h-4 text-[#22D3EE]" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Category Filter Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`h-9 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
              filter === f.id
                ? 'bg-[#8B5CF6] text-white'
                : 'bg-surface border border-line text-muted hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <section className="arena-surface rounded-2xl overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Bell className="w-8 h-8 mx-auto text-muted/60" aria-hidden="true" />
            <p className="font-display text-base font-bold text-ink">All Caught Up</p>
            <p className="text-xs text-muted">
              Room invitations, friend requests, tournament alerts, and reward notices appear here in real time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {visible.map((item) => {
              const Icon = getIcon(item.category);
              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    item.read ? 'opacity-75' : 'bg-[#8B5CF6]/[0.06]'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        item.read ? 'bg-panel text-muted' : 'bg-[#8B5CF6]/20 text-[#22D3EE]'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">
                        {item.title}
                        {!item.read && (
                          <span className="ml-2 text-[11px] font-mono text-[#22D3EE] font-semibold">Unread</span>
                        )}
                      </p>
                      <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.body}</p>
                      <p className="text-[11px] font-mono text-muted/80 mt-1 tabular-nums">
                        {new Date(item.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {item.actionType && (
                      <button
                        type="button"
                        onClick={() => handleAction(item)}
                        className="h-9 px-3.5 arena-gradient-btn rounded-xl text-xs font-semibold whitespace-nowrap"
                      >
                        {item.actionType === 'join_room'
                          ? 'Join Room'
                          : item.actionType === 'view_friends'
                            ? 'Open Friends'
                            : 'Open'}
                      </button>
                    )}
                    {!item.read && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(item.id)}
                        className="h-9 px-3 rounded-xl bg-panel border border-line text-xs font-medium text-muted hover:text-ink whitespace-nowrap"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
