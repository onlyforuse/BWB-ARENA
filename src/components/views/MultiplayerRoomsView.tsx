import React, { useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  Globe,
  KeyRound,
  Lock,
  LogOut,
  Play,
  Plus,
  Send,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import type { GameId } from '../../types/arena';
import { Avatar } from '../common/Avatar';
import { RoomChatPanel } from '../chat/RoomChatPanel';

export function MultiplayerRoomsView() {
  const {
    player,
    games,
    rooms,
    activeRoom,
    friends,
    platformSettings,
    createRoom,
    joinRoom,
    joinRoomByCode,
    leaveActiveRoom,
    toggleReady,
    updateRoomSettings,
    kickParticipant,
    inviteFriendToActiveRoom,
    startRoomMatch,
    pushToast,
  } = useArena();

  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<GameId>('tic-tac-toe');
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!player) return null;

  const enabledGames = games.filter((g) => g.enabled);
  const publicWaitingRooms = rooms.filter((r) => !r.isPrivate && r.status === 'waiting');

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createRoom({
        gameId: selectedGameId,
        name: roomName.trim() || `${player.displayName}'s Arena`,
        isPrivate,
        maxPlayers,
      });
      setCreateOpen(false);
      setRoomName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create room.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!joinCodeInput.trim()) {
      setError('Enter a room code to join.');
      return;
    }
    setBusy(true);
    try {
      await joinRoomByCode(joinCodeInput);
      setJoinCodeInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join room.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = () => {
    if (!activeRoom) return;
    navigator.clipboard?.writeText(activeRoom.code).catch(() => {});
    setCopiedCode(true);
    pushToast({ tone: 'info', title: 'Room Code Copied', message: `Code ${activeRoom.code} ready to share.` });
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleStartMatch = async () => {
    try {
      await startRoomMatch();
    } catch (err) {
      pushToast({
        tone: 'danger',
        title: 'Cannot Start Match',
        message: err instanceof Error ? err.message : 'Match failed to launch.',
      });
    }
  };

  // ACTIVE ROOM WAITING LOBBY + LIVE ROOM CHAT
  if (activeRoom) {
    const participants = Object.values(activeRoom.participants);
    const isHost = activeRoom.hostUid === player.uid;
    const myParticipant = activeRoom.participants[player.uid];
    const currentGame = games.find((g) => g.id === activeRoom.gameId);

    return (
      <div className="space-y-5">
        {/* Room Header Card */}
        <div className="arena-surface rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1 text-[#22D3EE] font-semibold">
                {activeRoom.isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                {activeRoom.isPrivate ? 'Private Room' : 'Public Room'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentGame?.title || activeRoom.gameId}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {participants.length}/{activeRoom.maxPlayers} Players
              </span>
            </div>
            <h2 className="font-display text-2xl font-extrabold text-ink">{activeRoom.name}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyCode}
              className="h-10 px-3.5 rounded-xl bg-panel border border-line font-mono text-sm font-bold text-[#22D3EE] inline-flex items-center gap-2 hover:border-[#22D3EE]/60"
            >
              <span>{activeRoom.code}</span>
              {copiedCode ? <Check className="w-4 h-4 text-[#22C55E]" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={toggleReady}
              className={`h-10 px-4 rounded-xl text-xs font-semibold border transition-colors ${
                myParticipant?.ready
                  ? 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]'
                  : 'bg-panel border-line text-ink hover:border-[#8B5CF6]/50'
              }`}
            >
              {myParticipant?.ready ? 'Ready ✓' : 'Mark Ready'}
            </button>

            {isHost && (
              <button
                type="button"
                onClick={handleStartMatch}
                className="arena-gradient-btn h-10 px-5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                <span>{participants.length >= 2 ? 'Start Live Match' : 'Start Practice Match'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={leaveActiveRoom}
              className="h-10 px-3.5 rounded-xl border border-line bg-panel text-xs font-semibold text-muted hover:text-[#EF4444] inline-flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* Lobby Grid: Participants & Host Controls + Live Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
          <div className="lg:col-span-3 space-y-5">
            {/* Participants List */}
            <section className="arena-surface rounded-2xl p-5">
              <h3 className="font-display text-base font-bold text-ink mb-3.5">
                Lobby Roster ({participants.length}/{activeRoom.maxPlayers})
              </h3>
              <div className="divide-y divide-line">
                {participants.map((p) => {
                  const pIsHost = p.uid === activeRoom.hostUid;
                  return (
                    <div key={p.uid} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          avatarId={p.avatarId}
                          avatarUrl={p.avatarUrl}
                          name={p.displayName}
                          size="sm"
                          online={p.online}
                          showPresence
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-ink truncate">{p.displayName}</p>
                            {pIsHost && (
                              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label="Room Host" />
                            )}
                          </div>
                          <p className="text-xs text-muted">
                            @{p.username} · {p.online ? 'Online' : 'Offline'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-semibold ${
                            p.ready ? 'text-[#22C55E]' : 'text-muted'
                          }`}
                        >
                          {p.ready ? 'Ready' : 'Waiting'}
                        </span>
                        {isHost && p.uid !== player.uid && (
                          <button
                            type="button"
                            onClick={() => kickParticipant(p.uid)}
                            aria-label={`Remove ${p.displayName} from room`}
                            className="p-1.5 rounded-lg text-muted hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Host Controls */}
            {isHost && (
              <section className="arena-surface rounded-2xl p-5 space-y-4">
                <h3 className="font-display text-base font-bold text-ink">Host Controls</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="lobby-game-select" className="block text-xs font-medium text-muted mb-1.5">
                      Active Game
                    </label>
                    <select
                      id="lobby-game-select"
                      value={activeRoom.gameId}
                      onChange={(e) => {
                        const nextId = e.target.value as GameId;
                        const def = enabledGames.find((x) => x.id === nextId);
                        updateRoomSettings({
                          gameId: nextId,
                          maxPlayers: def ? Math.min(def.maxPlayers, platformSettings.maxRoomCapacity) : activeRoom.maxPlayers,
                        });
                      }}
                      className="w-full h-10 pl-3 pr-8 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
                    >
                      {enabledGames.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title} ({g.minPlayers}–{g.maxPlayers}P)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="lobby-privacy-select" className="block text-xs font-medium text-muted mb-1.5">
                      Lobby Visibility
                    </label>
                    <select
                      id="lobby-privacy-select"
                      value={activeRoom.isPrivate ? 'private' : 'public'}
                      onChange={(e) => updateRoomSettings({ isPrivate: e.target.value === 'private' })}
                      className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
                    >
                      <option value="public" disabled={!platformSettings.publicRoomsEnabled}>
                        Public (Listed in Room Browser)
                      </option>
                      <option value="private">Private (Code / Invite Only)</option>
                    </select>
                  </div>
                </div>
              </section>
            )}

            {/* Invite Online Friends */}
            <section className="arena-surface rounded-2xl p-5">
              <h3 className="font-display text-base font-bold text-ink mb-3">Invite Friends</h3>
              {friends.length === 0 ? (
                <p className="text-xs text-muted">
                  Add players in the Friends section to send instant one-click room invitations, or share code{' '}
                  <span className="font-mono font-bold text-[#22D3EE]">{activeRoom.code}</span>.
                </p>
              ) : (
                <div className="divide-y divide-line">
                  {friends.map((fr) => (
                    <div key={fr.uid} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          avatarId={fr.avatarId}
                          avatarUrl={fr.avatarUrl}
                          name={fr.displayName}
                          size="xs"
                          online={fr.online}
                          showPresence
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{fr.displayName}</p>
                          <p className="text-[11px] text-muted">
                            @{fr.username} · {fr.online ? 'Online' : 'Offline'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => inviteFriendToActiveRoom(fr)}
                        className="h-8 px-3 rounded-lg bg-panel border border-line text-xs font-semibold text-[#22D3EE] hover:border-[#22D3EE]/50 inline-flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Invite</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="lg:col-span-2">
            <RoomChatPanel />
          </div>
        </div>
      </div>
    );
  }

  // ROOM BROWSER + CREATE / JOIN BY CODE
  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2 arena-surface rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">Multiplayer Lobbies</h2>
            <p className="text-sm text-muted mt-1">
              Create a code-protected private squad room or join a live public arena via atomic Firebase transactions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setCreateOpen(true);
            }}
            className="arena-gradient-btn h-11 px-5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Room</span>
          </button>
        </div>

        {/* Join by Room Code */}
        <form onSubmit={handleJoinByCode} className="arena-surface rounded-2xl p-5 flex flex-col justify-between gap-3">
          <label htmlFor="join-room-code" className="text-xs font-semibold text-muted inline-flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#22D3EE]" aria-hidden="true" />
            Join Private or Public Room by Code
          </label>
          <div className="flex items-center gap-2">
            <input
              id="join-room-code"
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="e.g. X7K4P9"
              className="flex-1 h-10 px-3 rounded-xl bg-panel border border-line font-mono text-sm uppercase tracking-widest text-ink focus:outline-none focus:border-[#8B5CF6]"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-10 px-4 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold hover:brightness-110 whitespace-nowrap disabled:opacity-60"
            >
              Join
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-xs text-[#EF4444]">
          {error}
        </div>
      )}

      {/* Live Public Rooms Directory */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">
            Active Public Rooms ({publicWaitingRooms.length})
          </h3>
          {!platformSettings.publicRoomsEnabled && (
            <span className="text-xs text-amber-400 font-medium">Public room creation paused by admin</span>
          )}
        </div>

        {publicWaitingRooms.length === 0 ? (
          <div className="arena-surface rounded-2xl p-10 text-center space-y-3">
            <Users className="w-8 h-8 mx-auto text-[#8B5CF6]" aria-hidden="true" />
            <div>
              <p className="font-display text-lg font-bold text-ink">No Open Public Lobbies Right Now</p>
              <p className="text-sm text-muted mt-1 max-w-md mx-auto">
                Spin up a new lobby in seconds — your room code syncs immediately to Firebase Realtime Database so
                friends can join live.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="arena-gradient-btn h-10 px-5 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Host First Room</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {publicWaitingRooms.map((room) => {
              const count = Object.keys(room.participants).length;
              const gameTitle = games.find((g) => g.id === room.gameId)?.title ?? room.gameId;
              const isFull = count >= room.maxPlayers;

              return (
                <article key={room.roomId} className="arena-surface rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted mb-1">
                      <span className="font-semibold text-[#22D3EE]">{gameTitle}</span>
                      <span className="font-mono tabular-nums">Code {room.code}</span>
                    </div>
                    <h4 className="font-display text-base font-bold text-ink truncate">{room.name}</h4>
                    <p className="text-xs text-muted mt-1">
                      Host: @{room.hostUsername} ·{' '}
                      <span className="font-mono tabular-nums">
                        {count}/{room.maxPlayers} Players
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-line">
                    <div className="flex -space-x-2">
                      {Object.values(room.participants)
                        .slice(0, 4)
                        .map((p) => (
                          <Avatar
                            key={p.uid}
                            avatarId={p.avatarId}
                            avatarUrl={p.avatarUrl}
                            name={p.displayName}
                            size="xs"
                          />
                        ))}
                    </div>
                    <button
                      type="button"
                      disabled={isFull || busy}
                      onClick={() => joinRoom(room.roomId).catch((e) => setError(e.message))}
                      className="h-9 px-4 arena-gradient-btn rounded-xl text-xs font-semibold disabled:opacity-50"
                    >
                      {isFull ? 'Room Full' : 'Join Lobby'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Create Room Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-room-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form onSubmit={handleCreateSubmit} className="arena-surface rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="create-room-title" className="font-display text-xl font-bold text-ink">
                Create Multiplayer Room
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close create room modal"
                className="p-1.5 rounded-lg text-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label htmlFor="new-room-name" className="block text-xs font-medium text-muted mb-1.5">
                Room Name
              </label>
              <input
                id="new-room-name"
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder={`${player.displayName}'s Squad Lobby`}
                maxLength={40}
                className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div>
              <label htmlFor="new-room-game" className="block text-xs font-medium text-muted mb-1.5">
                Select Game
              </label>
              <select
                id="new-room-game"
                value={selectedGameId}
                onChange={(e) => {
                  const id = e.target.value as GameId;
                  setSelectedGameId(id);
                  const g = enabledGames.find((x) => x.id === id);
                  if (g) setMaxPlayers(Math.min(g.maxPlayers, platformSettings.maxRoomCapacity));
                }}
                className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
              >
                {enabledGames.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({g.minPlayers}–{g.maxPlayers} Players)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-room-capacity" className="block text-xs font-medium text-muted mb-1.5">
                  Max Players
                </label>
                <input
                  id="new-room-capacity"
                  type="number"
                  min={2}
                  max={platformSettings.maxRoomCapacity}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line font-mono text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-muted mb-1.5">Room Privacy</span>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-panel border border-line h-10">
                  <button
                    type="button"
                    disabled={!platformSettings.publicRoomsEnabled}
                    onClick={() => setIsPrivate(false)}
                    className={`rounded-lg text-xs font-semibold ${
                      !isPrivate ? 'bg-[#8B5CF6] text-white' : 'text-muted'
                    }`}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`rounded-lg text-xs font-semibold ${
                      isPrivate ? 'bg-[#8B5CF6] text-white' : 'text-muted'
                    }`}
                  >
                    Private
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex-1 h-10 rounded-xl border border-line text-xs font-semibold text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 h-10 arena-gradient-btn rounded-xl text-xs font-semibold disabled:opacity-60"
              >
                {busy ? 'Creating...' : 'Create Lobby'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
