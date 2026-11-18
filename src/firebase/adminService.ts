import { get, limitToLast, onValue, push, query, ref, remove, set, update } from 'firebase/database';
import { rtdb } from './config';
import { buildDefaultPlayerProfile, mapFirebaseError } from './arenaService';
import { buildAuditLogEntry } from '../lib/adminRules';
import type {
  AccountDeletionRequest,
  AccountStatus,
  AdminActor,
  AdminAuditCategory,
  AdminLogEntry,
  AdminReport,
  ArenaGameDefinition,
  ChatMessage,
  GameId,
  GameRoom,
  LeaderboardEntry,
  PlatformAnnouncement,
  PlatformSettings,
  PlayerProfile,
  ReportStatus,
  TournamentItem,
} from '../types/arena';

// ---------------------------------------------------------------------------
// Admin Authorization Verification (/admins/{uid} === true)
// ---------------------------------------------------------------------------

export async function verifyAdminAuthorization(uid: string): Promise<boolean> {
  try {
    const snap = await get(ref(rtdb, `admins/${uid}`));
    return snap.exists() && snap.val() === true;
  } catch {
    return false;
  }
}

export async function writeAdminAuditLog(
  actor: AdminActor,
  params: {
    category: AdminAuditCategory;
    action: string;
    target: string;
    details: string;
  },
): Promise<AdminLogEntry> {
  const entry = buildAuditLogEntry({
    adminUid: actor.uid,
    adminEmail: actor.email,
    ...params,
  });
  try {
    await set(ref(rtdb, `adminLogs/${entry.id}`), entry);
  } catch {
    // Allow main operation to continue even if audit write is transiently blocked
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Real-Time Admin Subscriptions
// ---------------------------------------------------------------------------

export function subscribeAllUsersAdmin(cb: (users: PlayerProfile[]) => void): () => void {
  const usersRef = ref(rtdb, 'users');
  const unsub = onValue(
    usersRef,
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const raw = snap.val() as Record<string, Partial<PlayerProfile>>;
      const list = Object.entries(raw).map(([uid, val]) => {
        const base = buildDefaultPlayerProfile({
          uid,
          fullName: val.fullName || val.displayName || 'Player',
          username: val.username || `player_${uid.slice(0, 6)}`,
          email: val.email || '',
          emailVerified: Boolean(val.emailVerified),
          avatarId: val.avatarId || 'cyber-wolf',
          avatarUrl: val.avatarUrl || '',
        });
        return {
          ...base,
          ...val,
          uid,
          gameStats: val.gameStats || {},
          recentMatches: Array.isArray(val.recentMatches) ? val.recentMatches : [],
        };
      });
      cb(list);
    },
    () => cb([]),
  );
  return () => unsub();
}

export function subscribeAllRoomsAdmin(cb: (rooms: GameRoom[]) => void): () => void {
  const roomsRef = ref(rtdb, 'rooms');
  const unsub = onValue(
    roomsRef,
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const list = Object.entries(snap.val() as Record<string, GameRoom>)
        .map(([roomId, r]) => ({ ...r, roomId, participants: r.participants || {} }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cb(list);
    },
    () => cb([]),
  );
  return () => unsub();
}

export function subscribeReportsAdmin(cb: (reports: AdminReport[]) => void): () => void {
  const rRef = ref(rtdb, 'reports');
  const unsub = onValue(
    rRef,
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const list = Object.entries(snap.val() as Record<string, AdminReport>)
        .map(([id, item]) => ({ ...item, id }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cb(list);
    },
    () => cb([]),
  );
  return () => unsub();
}

export function subscribeDeletionRequestsAdmin(
  cb: (requests: AccountDeletionRequest[]) => void,
): () => void {
  const dRef = ref(rtdb, 'deletionRequests');
  const unsub = onValue(
    dRef,
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const list = Object.entries(snap.val() as Record<string, AccountDeletionRequest>)
        .map(([uid, item]) => ({ ...item, uid }))
        .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
      cb(list);
    },
    () => cb([]),
  );
  return () => unsub();
}

export function subscribeAdminLogs(cb: (logs: AdminLogEntry[]) => void): () => void {
  const q = query(ref(rtdb, 'adminLogs'), limitToLast(150));
  const unsub = onValue(
    q,
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const list = Object.entries(snap.val() as Record<string, AdminLogEntry>)
        .map(([id, entry]) => ({ ...entry, id }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      cb(list);
    },
    () => cb([]),
  );
  return () => unsub();
}

export async function fetchRoomMessagesAdmin(roomId: string): Promise<ChatMessage[]> {
  const snap = await get(query(ref(rtdb, `messages/${roomId}`), limitToLast(60)));
  if (!snap.exists()) return [];
  return Object.entries(snap.val() as Record<string, ChatMessage>)
    .map(([id, msg]) => ({ ...msg, id }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

// ---------------------------------------------------------------------------
// Admin Mutations (Each Writes Authoritative Updates + Audit Trail)
// ---------------------------------------------------------------------------

export async function adminSetUserStatus(
  actor: AdminActor,
  target: PlayerProfile,
  nextStatus: AccountStatus,
  reason: string,
): Promise<void> {
  try {
    const updates: Record<string, unknown> = {
      [`users/${target.uid}/status`]: nextStatus,
      [`publicProfiles/${target.uid}/status`]: nextStatus,
    };
    if (nextStatus !== 'active') {
      updates[`users/${target.uid}/online`] = false;
      updates[`publicProfiles/${target.uid}/online`] = false;
    }
    await update(ref(rtdb), updates);

    await push(ref(rtdb, `notifications/${target.uid}`), {
      category: 'admin_notice',
      title: `Account Status: ${nextStatus.toUpperCase()}`,
      body: reason.trim() || `An administrator updated your account status to ${nextStatus}.`,
      createdAt: Date.now(),
      read: false,
    }).catch(() => {});

    await writeAdminAuditLog(actor, {
      category: 'user',
      action:
        nextStatus === 'banned'
          ? 'Banned User'
          : nextStatus === 'suspended'
            ? 'Suspended User'
            : 'Restored User',
      target: `@${target.username}`,
      details: reason.trim() || `Status changed to ${nextStatus}.`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminAdjustEconomy(
  actor: AdminActor,
  target: PlayerProfile,
  params: { nextCoins: number; nextXp: number; nextLevel: number; coinsDelta: number; xpDelta: number; reason: string },
): Promise<void> {
  try {
    await update(ref(rtdb), {
      [`users/${target.uid}/coins`]: params.nextCoins,
      [`users/${target.uid}/xp`]: params.nextXp,
      [`users/${target.uid}/level`]: params.nextLevel,
      [`publicProfiles/${target.uid}/xp`]: params.nextXp,
      [`publicProfiles/${target.uid}/level`]: params.nextLevel,
    });

    await push(ref(rtdb, `notifications/${target.uid}`), {
      category: 'reward',
      title: 'Admin Account Adjustment',
      body: `${params.coinsDelta >= 0 ? '+' : ''}${params.coinsDelta} Coins, ${params.xpDelta >= 0 ? '+' : ''}${params.xpDelta} XP · ${params.reason || 'Operations adjustment'}`,
      createdAt: Date.now(),
      read: false,
    }).catch(() => {});

    await writeAdminAuditLog(actor, {
      category: 'economy',
      action: 'Adjusted Coins / XP',
      target: `@${target.username}`,
      details: `Coins ${params.coinsDelta >= 0 ? '+' : ''}${params.coinsDelta} (-> ${params.nextCoins}), XP ${params.xpDelta >= 0 ? '+' : ''}${params.xpDelta} (-> ${params.nextXp}, Lvl ${params.nextLevel}). ${params.reason}`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminResetPlayerStats(
  actor: AdminActor,
  target: PlayerProfile,
  reason: string,
): Promise<void> {
  try {
    await update(ref(rtdb), {
      [`users/${target.uid}/gamesPlayed`]: 0,
      [`users/${target.uid}/wins`]: 0,
      [`users/${target.uid}/losses`]: 0,
      [`users/${target.uid}/draws`]: 0,
      [`users/${target.uid}/currentStreak`]: 0,
      [`users/${target.uid}/bestStreak`]: 0,
      [`users/${target.uid}/gameStats`]: {},
      [`publicProfiles/${target.uid}/gamesPlayed`]: 0,
      [`publicProfiles/${target.uid}/wins`]: 0,
      [`publicProfiles/${target.uid}/losses`]: 0,
    });

    await writeAdminAuditLog(actor, {
      category: 'user',
      action: 'Reset Match Stats',
      target: `@${target.username}`,
      details: reason.trim() || 'Cleared gamesPlayed, wins, losses, and streaks.',
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminProcessDeletionRequest(
  actor: AdminActor,
  request: AccountDeletionRequest,
  decision: 'approved' | 'rejected',
): Promise<void> {
  try {
    const now = Date.now();
    const updates: Record<string, unknown> = {
      [`deletionRequests/${request.uid}/status`]: decision,
      [`deletionRequests/${request.uid}/processedAt`]: now,
      [`deletionRequests/${request.uid}/processedBy`]: actor.email,
    };
    if (decision === 'approved') {
      updates[`users/${request.uid}/status`] = 'banned';
      updates[`users/${request.uid}/online`] = false;
      updates[`publicProfiles/${request.uid}/status`] = 'banned';
      updates[`publicProfiles/${request.uid}/online`] = false;
    } else {
      updates[`users/${request.uid}/deletionRequestedAt`] = null;
    }
    await update(ref(rtdb), updates);

    await writeAdminAuditLog(actor, {
      category: 'user',
      action: decision === 'approved' ? 'Approved Account Deletion' : 'Rejected Account Deletion',
      target: `@${request.username}`,
      details: `Ticket processed (${decision}).`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminSaveGameConfig(
  actor: AdminActor,
  game: ArenaGameDefinition,
): Promise<void> {
  try {
    await set(ref(rtdb, `games/${game.id}`), game);
    await writeAdminAuditLog(actor, {
      category: 'game',
      action: 'Updated Game Config',
      target: game.title,
      details: `Enabled: ${game.enabled}, Featured: ${game.featured}, MaxPlayers: ${game.maxPlayers}, Win XP: ${game.xpRewardWin}, Win Coins: ${game.coinRewardWin}.`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminCloseRoom(actor: AdminActor, room: GameRoom): Promise<void> {
  try {
    await update(ref(rtdb, `rooms/${room.roomId}`), {
      status: 'closed',
      activeSessionId: null,
      updatedAt: Date.now(),
    });
    const participantUids = Object.keys(room.participants || {});
    await Promise.all(
      participantUids.map((uid) =>
        push(ref(rtdb, `notifications/${uid}`), {
          category: 'admin_notice',
          title: `Room ${room.code} Closed by Admin`,
          body: `Lobby "${room.name}" was closed by BWB ARENA operations.`,
          createdAt: Date.now(),
          read: false,
        }).catch(() => {}),
      ),
    );
    await writeAdminAuditLog(actor, {
      category: 'room',
      action: 'Force Closed Room',
      target: `${room.name} (${room.code})`,
      details: `Disconnected ${participantUids.length} participant(s).`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminKickPlayerFromRoom(
  actor: AdminActor,
  room: GameRoom,
  targetUid: string,
  targetUsername: string,
): Promise<void> {
  try {
    await remove(ref(rtdb, `rooms/${room.roomId}/participants/${targetUid}`));
    await push(ref(rtdb, `notifications/${targetUid}`), {
      category: 'admin_notice',
      title: `Removed from Room ${room.code}`,
      body: 'A platform administrator removed you from the multiplayer lobby.',
      createdAt: Date.now(),
      read: false,
    }).catch(() => {});
    await writeAdminAuditLog(actor, {
      category: 'room',
      action: 'Kicked Room Participant',
      target: `@${targetUsername}`,
      details: `Removed from room ${room.name} (${room.code}).`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminDeleteChatMessage(
  actor: AdminActor,
  roomId: string,
  messageId: string,
  reason: string,
): Promise<void> {
  try {
    await update(ref(rtdb, `messages/${roomId}/${messageId}`), {
      deleted: true,
      text: '[Removed by BWB ARENA Moderator]',
    });
    await writeAdminAuditLog(actor, {
      category: 'moderation',
      action: 'Deleted Chat Message',
      target: `Room ${roomId}`,
      details: `Message ${messageId} removed. ${reason}`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminUpdateReportStatus(
  actor: AdminActor,
  report: AdminReport,
  nextStatus: ReportStatus,
  resolutionNote: string,
  deleteMessage?: boolean,
): Promise<void> {
  try {
    if (deleteMessage && report.roomId && report.messageId) {
      await update(ref(rtdb, `messages/${report.roomId}/${report.messageId}`), {
        deleted: true,
        text: '[Removed by BWB ARENA Moderator]',
      }).catch(() => {});
    }

    await update(ref(rtdb, `reports/${report.id}`), {
      status: nextStatus,
      resolvedAt: Date.now(),
      resolvedBy: actor.email,
      resolutionNote: resolutionNote.trim() || `Marked as ${nextStatus}`,
      messageDeleted: Boolean(deleteMessage || report.messageDeleted),
    });

    await writeAdminAuditLog(actor, {
      category: 'moderation',
      action: nextStatus === 'resolved' ? 'Resolved Report' : 'Dismissed Report',
      target: `@${report.reportedUsername}`,
      details: `${resolutionNote.trim() || nextStatus}${deleteMessage ? ' (chat message removed)' : ''}`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminSaveAnnouncement(
  actor: AdminActor,
  announcement: Omit<PlatformAnnouncement, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
): Promise<PlatformAnnouncement> {
  try {
    const id = announcement.id || push(ref(rtdb, 'announcements')).key || `ann_${Date.now()}`;
    const payload: PlatformAnnouncement = {
      id,
      title: announcement.title.trim(),
      body: announcement.body.trim(),
      pinned: Boolean(announcement.pinned),
      breaking: Boolean(announcement.breaking),
      createdAt: announcement.createdAt || Date.now(),
      authorLabel: announcement.authorLabel || 'BWB ARENA HQ',
    };
    await set(ref(rtdb, `announcements/${id}`), payload);
    await writeAdminAuditLog(actor, {
      category: 'announcement',
      action: announcement.id ? 'Updated Announcement' : 'Published Announcement',
      target: payload.title,
      details: `Pinned: ${payload.pinned}, Breaking: ${payload.breaking}`,
    });
    return payload;
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminDeleteAnnouncement(
  actor: AdminActor,
  announcement: PlatformAnnouncement,
): Promise<void> {
  try {
    await remove(ref(rtdb, `announcements/${announcement.id}`));
    await writeAdminAuditLog(actor, {
      category: 'announcement',
      action: 'Deleted Announcement',
      target: announcement.title,
      details: `Removed announcement ID ${announcement.id}.`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminBroadcastSystemNotification(
  actor: AdminActor,
  targetUids: string[],
  payload: { title: string; body: string },
): Promise<void> {
  try {
    const now = Date.now();
    await Promise.all(
      targetUids.map((uid) =>
        push(ref(rtdb, `notifications/${uid}`), {
          category: 'admin_notice',
          title: payload.title.trim(),
          body: payload.body.trim(),
          createdAt: now,
          read: false,
        }),
      ),
    );
    await writeAdminAuditLog(actor, {
      category: 'announcement',
      action: 'Broadcast System Notification',
      target: `${targetUids.length} player(s)`,
      details: `${payload.title.trim()} — ${payload.body.trim().slice(0, 80)}`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminSaveTournament(
  actor: AdminActor,
  draft: Omit<TournamentItem, 'id' | 'registeredUids'> & { id?: string; registeredUids?: Record<string, boolean> },
): Promise<TournamentItem> {
  try {
    const id = draft.id || push(ref(rtdb, 'tournaments')).key || `t_${Date.now()}`;
    const item: TournamentItem = {
      id,
      title: draft.title.trim(),
      gameId: draft.gameId as GameId,
      startsAt: draft.startsAt,
      prizeCoins: draft.prizeCoins,
      prizeXp: draft.prizeXp,
      maxSlots: draft.maxSlots,
      format: draft.format.trim(),
      registeredUids: draft.registeredUids || {},
    };
    await set(ref(rtdb, `tournaments/${id}`), item);
    await writeAdminAuditLog(actor, {
      category: 'tournament',
      action: draft.id ? 'Updated Tournament' : 'Created Tournament',
      target: item.title,
      details: `${item.gameId} · ${item.prizeCoins} Coins · ${item.maxSlots} slots`,
    });
    return item;
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminDeleteTournament(
  actor: AdminActor,
  tournament: TournamentItem,
): Promise<void> {
  try {
    await remove(ref(rtdb, `tournaments/${tournament.id}`));
    await writeAdminAuditLog(actor, {
      category: 'tournament',
      action: 'Deleted Tournament',
      target: tournament.title,
      details: `Removed tournament ID ${tournament.id}.`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminRemoveLeaderboardEntry(
  actor: AdminActor,
  boardKey: string,
  entry: LeaderboardEntry,
): Promise<void> {
  try {
    await remove(ref(rtdb, `leaderboards/${boardKey}/${entry.uid}`));
    await writeAdminAuditLog(actor, {
      category: 'leaderboard',
      action: 'Removed Leaderboard Entry',
      target: `@${entry.username}`,
      details: `Removed from "${boardKey}" board (was ${entry.score} pts).`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminResetLeaderboard(actor: AdminActor, boardKey: string): Promise<void> {
  try {
    await remove(ref(rtdb, `leaderboards/${boardKey}`));
    await writeAdminAuditLog(actor, {
      category: 'leaderboard',
      action: 'Reset Leaderboard',
      target: boardKey,
      details: `Cleared all seasonal entries on board "${boardKey}".`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function adminSavePlatformSettings(
  actor: AdminActor,
  settings: PlatformSettings,
): Promise<void> {
  try {
    await set(ref(rtdb, 'platformSettings'), settings);
    await writeAdminAuditLog(actor, {
      category: 'settings',
      action: 'Updated Platform Settings',
      target: settings.platformName,
      details: `Maintenance: ${settings.maintenanceMode}, Reg: ${settings.registrationEnabled}, Login: ${settings.loginEnabled}, Chat: ${settings.chatEnabled}, PublicRooms: ${settings.publicRoomsEnabled}.`,
    });
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}
