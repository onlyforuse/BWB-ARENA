import React, { useState } from 'react';
import { Check, Search, Send, UserCheck, UserPlus, UserX, Users, X } from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import type { PublicPlayerSummary } from '../../types/arena';
import { Avatar } from '../common/Avatar';
import { calculateWinRate } from '../../lib/gameRules';

export function FriendsView() {
  const {
    isGuestPractice,
    friends,
    friendRequests,
    activeRoom,
    searchPlayers,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
    inviteFriendToActiveRoom,
    pushToast,
  } = useArena();

  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<PublicPlayerSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [filterOnlineOnly, setFilterOnlineOnly] = useState(false);
  const [inspectFriend, setInspectFriend] = useState<PublicPlayerSummary | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (queryText.trim().length < 2) {
      pushToast({ tone: 'info', title: 'Enter at least 2 characters', message: 'Search by username or display name.' });
      return;
    }
    setSearching(true);
    try {
      const found = await searchPlayers(queryText);
      setResults(found);
      if (found.length === 0) {
        pushToast({
          tone: 'info',
          title: 'No matching players',
          message: isGuestPractice
            ? 'Sign in with a BWB Firebase account to search live registered players.'
            : `No players matched "${queryText}".`,
        });
      }
    } finally {
      setSearching(false);
    }
  };

  const visibleFriends = filterOnlineOnly ? friends.filter((f) => f.online) : friends;
  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <div className="space-y-6">
      {/* Search Players Bar */}
      <section className="arena-surface rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Friends & Squad Roster</h2>
          <p className="text-sm text-muted mt-0.5">
            Find competitors by username, manage requests, see live online presence, and invite friends straight into
            your room.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search players by @username..."
              aria-label="Search BWB ARENA players"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="arena-gradient-btn h-11 px-5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0"
          >
            {searching ? 'Searching...' : 'Search Players'}
          </button>
        </form>

        {/* Search Results */}
        {results.length > 0 && (
          <div className="pt-2 border-t border-line space-y-2">
            <p className="text-xs font-semibold text-muted">Search Results ({results.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {results.map((u) => {
                const alreadyFriend = friends.some((f) => f.uid === u.uid);
                return (
                  <div
                    key={u.uid}
                    className="rounded-xl bg-panel border border-line p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        avatarId={u.avatarId}
                        avatarUrl={u.avatarUrl}
                        name={u.displayName}
                        size="sm"
                        online={u.online}
                        showPresence
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{u.displayName}</p>
                        <p className="text-xs text-muted truncate">
                          @{u.username} · Lvl {u.level}
                        </p>
                      </div>
                    </div>

                    {alreadyFriend ? (
                      <span className="text-xs font-semibold text-[#22C55E] inline-flex items-center gap-1 shrink-0">
                        <UserCheck className="w-3.5 h-3.5" /> Friends
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => sendFriendRequest(u)}
                        className="h-9 px-3 rounded-lg bg-[#8B5CF6] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 hover:brightness-110"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Incoming Friend Requests */}
      {friendRequests.length > 0 && (
        <section className="arena-surface rounded-2xl p-5 space-y-3">
          <h3 className="font-display text-base font-bold text-ink">
            Incoming Requests ({friendRequests.length})
          </h3>
          <div className="divide-y divide-line">
            {friendRequests.map((req) => (
              <div key={req.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    avatarId={req.fromAvatarId}
                    avatarUrl={req.fromAvatarUrl}
                    name={req.fromDisplayName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{req.fromDisplayName}</p>
                    <p className="text-xs text-muted">@{req.fromUsername} sent a friend request</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => respondFriendRequest(req, true)}
                    className="h-9 px-3.5 rounded-xl bg-[#22C55E] text-[#080A12] text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => respondFriendRequest(req, false)}
                    className="h-9 px-3 rounded-xl border border-line bg-panel text-xs font-semibold text-muted hover:text-[#EF4444]"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends List */}
      <section className="arena-surface rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-ink">
              Your Friends ({friends.length})
            </h3>
            <p className="text-xs text-muted tabular-nums">{onlineCount} currently online</p>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-panel border border-line">
            <button
              type="button"
              onClick={() => setFilterOnlineOnly(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                !filterOnlineOnly ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
              }`}
            >
              All ({friends.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterOnlineOnly(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                filterOnlineOnly ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
              }`}
            >
              Online ({onlineCount})
            </button>
          </div>
        </div>

        {visibleFriends.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <Users className="w-8 h-8 mx-auto text-muted/60" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">
              {filterOnlineOnly ? 'No friends online right now' : 'No friends added yet'}
            </p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Use the username search above to connect with squadmates and invite them directly to private or public
              rooms.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {visibleFriends.map((fr) => (
              <div
                key={fr.uid}
                className="rounded-xl bg-panel border border-line p-4 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => setInspectFriend(fr)}
                  className="flex items-center gap-3 min-w-0 text-left hover:opacity-90"
                >
                  <Avatar
                    avatarId={fr.avatarId}
                    avatarUrl={fr.avatarUrl}
                    name={fr.displayName}
                    size="md"
                    online={fr.online}
                    showPresence
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{fr.displayName}</p>
                    <p className="text-xs text-muted truncate">
                      @{fr.username} · {fr.online ? 'Online' : 'Offline'} · Lvl {fr.level}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => inviteFriendToActiveRoom(fr)}
                    disabled={!activeRoom}
                    title={activeRoom ? `Invite to room ${activeRoom.code}` : 'Join or create a room first'}
                    className="h-9 px-3 rounded-lg bg-surface border border-line text-xs font-semibold text-[#22D3EE] disabled:opacity-40 inline-flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Invite</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFriend(fr.uid)}
                    aria-label={`Remove ${fr.displayName} from friends`}
                    className="h-9 w-9 rounded-lg bg-surface border border-line flex items-center justify-center text-muted hover:text-[#EF4444]"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Friend Profile Modal */}
      {inspectFriend && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Profile for ${inspectFriend.displayName}`}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="arena-surface rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <Avatar
                  avatarId={inspectFriend.avatarId}
                  avatarUrl={inspectFriend.avatarUrl}
                  name={inspectFriend.displayName}
                  size="lg"
                  online={inspectFriend.online}
                  showPresence
                />
                <div>
                  <h3 className="font-display text-xl font-bold text-ink">{inspectFriend.displayName}</h3>
                  <p className="text-xs text-muted">
                    @{inspectFriend.username} · {inspectFriend.online ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectFriend(null)}
                aria-label="Close friend profile"
                className="p-1.5 text-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted leading-relaxed">{inspectFriend.bio}</p>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl bg-panel border border-line p-3">
                <p className="text-[11px] text-muted">Level</p>
                <p className="font-mono text-lg font-bold text-ink tabular-nums">{inspectFriend.level}</p>
              </div>
              <div className="rounded-xl bg-panel border border-line p-3">
                <p className="text-[11px] text-muted">Wins</p>
                <p className="font-mono text-lg font-bold text-[#22C55E] tabular-nums">{inspectFriend.wins}</p>
              </div>
              <div className="rounded-xl bg-panel border border-line p-3">
                <p className="text-[11px] text-muted">Win Rate</p>
                <p className="font-mono text-lg font-bold text-[#22D3EE] tabular-nums">
                  {calculateWinRate(inspectFriend.wins, inspectFriend.gamesPlayed)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
