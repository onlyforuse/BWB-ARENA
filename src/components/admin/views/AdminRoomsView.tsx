import { useMemo, useState } from 'react';
import { Lock, MessageSquare, PowerOff, Trash2, Unlock, UserMinus, X } from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import type { ChatMessage, GameRoom } from '../../../types/arena';

export function AdminRoomsView() {
  const { rooms, games, forceCloseRoom, kickRoomUser, loadRoomMessages, deleteChatMessage } = useAdmin();

  const [filterStatus, setFilterStatus] = useState<'live' | 'all' | 'closed'>('live');
  const [inspectRoomId, setInspectRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const gameTitleMap = useMemo(
    () => Object.fromEntries(games.map((g) => [g.id, g.title])),
    [games],
  );

  const visibleRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (filterStatus === 'live') return r.status !== 'closed';
      if (filterStatus === 'closed') return r.status === 'closed';
      return true;
    });
  }, [rooms, filterStatus]);

  const inspectedRoom: GameRoom | null = useMemo(
    () => rooms.find((r) => r.roomId === inspectRoomId) || null,
    [rooms, inspectRoomId],
  );

  const handleInspectChat = async (room: GameRoom) => {
    setInspectRoomId(room.roomId);
    setLoadingChat(true);
    try {
      const list = await loadRoomMessages(room.roomId);
      setMessages(list);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleDeleteMsg = async (roomId: string, msgId: string) => {
    await deleteChatMessage(roomId, msgId, 'Moderator live room chat redaction');
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, deleted: true, text: '[Removed by BWB ARENA Moderator]' } : m)),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Multiplayer Room Operations</h2>
          <p className="text-xs text-muted mt-0.5 tabular-nums">
            {rooms.filter((r) => r.status !== 'closed').length} live rooms ·{' '}
            {rooms.filter((r) => r.status === 'in_game').length} in active match
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-panel border border-line self-start">
          {(
            [
              { id: 'live', label: 'Live Rooms' },
              { id: 'closed', label: 'Closed' },
              { id: 'all', label: 'All' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                filterStatus === tab.id ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {visibleRooms.length === 0 ? (
        <div className="arena-surface rounded-2xl p-10 text-center space-y-2">
          <p className="font-display font-semibold text-ink">No multiplayer rooms in this view</p>
          <p className="text-xs text-muted">Active lobbies created by players appear here in real time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {visibleRooms.map((room) => {
            const participantList = Object.values(room.participants || {});
            const isClosed = room.status === 'closed';
            return (
              <article key={room.roomId} className="arena-surface rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono text-muted">
                      <span className="text-[#22D3EE] font-semibold">{room.code}</span>
                      <span>·</span>
                      <span>{gameTitleMap[room.gameId] || room.gameId}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        {room.isPrivate ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {room.isPrivate ? 'Private' : 'Public'}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-ink truncate">{room.name}</h3>
                    <p className="text-xs text-muted">
                      Host: <span className="font-mono text-ink">@{room.hostUsername}</span> ·{' '}
                      <span className="tabular-nums">
                        {participantList.length}/{room.maxPlayers} players
                      </span>
                    </p>
                  </div>

                  <span
                    className={`text-xs font-semibold capitalize whitespace-nowrap ${
                      room.status === 'in_game'
                        ? 'text-[#22D3EE]'
                        : room.status === 'waiting'
                          ? 'text-[#22C55E]'
                          : 'text-muted'
                    }`}
                  >
                    {room.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Participant Roster */}
                <div className="divide-y divide-line border-t border-b border-line">
                  {participantList.length === 0 ? (
                    <p className="py-2.5 text-xs text-muted">No active participants remaining.</p>
                  ) : (
                    participantList.map((p) => (
                      <div key={p.uid} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-medium text-ink">{p.displayName}</span>
                          <span className="font-mono text-muted"> @{p.username}</span>
                          {p.uid === room.hostUid && <span className="text-[#8B5CF6]"> · Host</span>}
                          {p.ready && <span className="text-[#22C55E]"> · Ready</span>}
                        </div>
                        {!isClosed && (
                          <button
                            type="button"
                            onClick={() => void kickRoomUser(room, p.uid, p.username)}
                            aria-label={`Kick ${p.username} from ${room.code}`}
                            className="h-7 px-2.5 rounded-lg border border-line text-[11px] font-medium text-muted hover:text-red-400 hover:border-red-500/40 inline-flex items-center gap-1 shrink-0"
                          >
                            <UserMinus className="w-3 h-3" />
                            <span>Kick</span>
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Room Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void handleInspectChat(room)}
                    className="h-9 px-3.5 rounded-xl bg-surface-elevated border border-line hover:border-[#22D3EE]/50 text-xs font-semibold text-ink inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#22D3EE]" />
                    <span>Inspect Chat</span>
                  </button>

                  {!isClosed && (
                    <button
                      type="button"
                      onClick={() => void forceCloseRoom(room)}
                      aria-label={`Force close room ${room.code}`}
                      className="h-9 px-3.5 rounded-xl bg-red-500/12 border border-red-500/35 hover:bg-red-500/20 text-xs font-semibold text-red-300 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <PowerOff className="w-3.5 h-3.5" />
                      <span>Force Close Room</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Room Chat Inspection Modal */}
      {inspectedRoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Room chat for ${inspectedRoom.code}`}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInspectRoomId(null)}
        >
          <div
            className="arena-surface rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-line flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-mono text-[#22D3EE]">Chat Log · {inspectedRoom.code}</p>
                <h3 className="font-display text-base font-bold text-ink">{inspectedRoom.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectRoomId(null)}
                aria-label="Close room chat log"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {loadingChat ? (
                <p className="text-xs text-muted text-center py-6">Loading chat messages...</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-muted text-center py-6">No chat messages logged in this room.</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="rounded-xl bg-panel border border-line p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-mono text-muted">
                        <span className="text-ink font-semibold">@{msg.senderUsername}</span> ·{' '}
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className={`text-sm break-words ${msg.deleted ? 'italic text-muted' : 'text-ink'}`}>
                        {msg.text}
                      </p>
                    </div>
                    {!msg.deleted && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteMsg(inspectedRoom.roomId, msg.id)}
                        aria-label={`Delete message from ${msg.senderUsername}`}
                        className="h-8 px-2.5 rounded-lg border border-red-500/30 text-xs font-medium text-red-300 hover:bg-red-500/15 inline-flex items-center gap-1 shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
