import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase/config';
import * as playerSvc from '../firebase/arenaService';
import * as adminSvc from '../firebase/adminService';
import {
  DEFAULT_PLATFORM_SETTINGS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_GAMES_CATALOG,
  INITIAL_TOURNAMENTS,
} from '../data/catalog';
import {
  SANDBOX_ADMIN_LOGS,
  SANDBOX_DELETION_REQUESTS,
  SANDBOX_LEADERBOARDS,
  SANDBOX_MESSAGES,
  SANDBOX_REPORTS,
  SANDBOX_ROOMS,
  SANDBOX_USERS,
} from '../data/adminSeed';
import {
  buildAuditLogEntry,
  computeAdminAnalytics,
  type AdminAnalyticsSummary,
} from '../lib/adminRules';
import { hasAutostartFlag } from '../lib/routing';
import { useArena } from './ArenaContext';
import type {
  AccountDeletionRequest,
  AccountStatus,
  AdminActor,
  AdminLogEntry,
  AdminNavSection,
  AdminReport,
  ArenaGameDefinition,
  ChatMessage,
  GameRoom,
  LeaderboardEntry,
  PlatformAnnouncement,
  PlatformSettings,
  PlayerProfile,
  ReportStatus,
  TournamentItem,
} from '../types/arena';

interface AdminContextValue {
  authChecking: boolean;
  firebaseUser: User | null;
  isAuthorizedAdmin: boolean;
  isSandboxMode: boolean;
  actor: AdminActor | null;
  activeSection: AdminNavSection;
  setActiveSection: (section: AdminNavSection) => void;

  // Live / Sandbox datasets
  users: PlayerProfile[];
  games: ArenaGameDefinition[];
  rooms: GameRoom[];
  reports: AdminReport[];
  deletionRequests: AccountDeletionRequest[];
  announcements: PlatformAnnouncement[];
  tournaments: TournamentItem[];
  platformSettings: PlatformSettings;
  auditLogs: AdminLogEntry[];
  analytics: AdminAnalyticsSummary;

  // Auth actions
  signInAdmin: (email: string, password: string) => Promise<void>;
  signOutAdmin: () => Promise<void>;
  recheckAuthorization: () => Promise<boolean>;
  enterSandboxMode: () => void;
  exitSandboxMode: () => void;

  // Admin operations
  updateUserStatus: (target: PlayerProfile, status: AccountStatus, reason: string) => Promise<void>;
  adjustUserEconomy: (
    target: PlayerProfile,
    params: { nextCoins: number; nextXp: number; nextLevel: number; coinsDelta: number; xpDelta: number; reason: string },
  ) => Promise<void>;
  resetUserStats: (target: PlayerProfile, reason: string) => Promise<void>;
  processDeletionRequest: (req: AccountDeletionRequest, decision: 'approved' | 'rejected') => Promise<void>;
  saveGameConfig: (game: ArenaGameDefinition) => Promise<void>;
  forceCloseRoom: (room: GameRoom) => Promise<void>;
  kickRoomUser: (room: GameRoom, targetUid: string, targetUsername: string) => Promise<void>;
  loadRoomMessages: (roomId: string) => Promise<ChatMessage[]>;
  deleteChatMessage: (roomId: string, messageId: string, reason: string) => Promise<void>;
  updateReportStatus: (
    report: AdminReport,
    status: ReportStatus,
    note: string,
    deleteMessage?: boolean,
  ) => Promise<void>;
  saveAnnouncement: (
    draft: Omit<PlatformAnnouncement, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
  ) => Promise<void>;
  deleteAnnouncement: (item: PlatformAnnouncement) => Promise<void>;
  broadcastNotification: (targetUids: string[], payload: { title: string; body: string }) => Promise<void>;
  saveTournament: (
    draft: Omit<TournamentItem, 'id' | 'registeredUids'> & { id?: string; registeredUids?: Record<string, boolean> },
  ) => Promise<void>;
  deleteTournament: (item: TournamentItem) => Promise<void>;
  subscribeBoard: (boardKey: string, cb: (entries: LeaderboardEntry[]) => void) => () => void;
  removeLeaderboardEntry: (boardKey: string, entry: LeaderboardEntry) => Promise<void>;
  resetLeaderboard: (boardKey: string) => Promise<void>;
  savePlatformSettings: (next: PlatformSettings) => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

const SANDBOX_ACTOR: AdminActor = {
  uid: 'uid_satyam_owner',
  email: 'owner@bwbarena.gg',
  displayName: 'Satyam (Super Admin)',
  mode: 'sandbox',
};

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { pushToast } = useArena();

  const initialAutostart =
    typeof window !== 'undefined' && hasAutostartFlag(window.location.search, window.location.hash);

  const [authChecking, setAuthChecking] = useState(!initialAutostart);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
  const [isSandboxMode, setIsSandboxMode] = useState(initialAutostart);
  const [activeSection, setActiveSection] = useState<AdminNavSection>('overview');

  // Datasets
  const [users, setUsers] = useState<PlayerProfile[]>(() => (initialAutostart ? SANDBOX_USERS : []));
  const [games, setGames] = useState<ArenaGameDefinition[]>(INITIAL_GAMES_CATALOG);
  const [rooms, setRooms] = useState<GameRoom[]>(() => (initialAutostart ? SANDBOX_ROOMS : []));
  const [reports, setReports] = useState<AdminReport[]>(() => (initialAutostart ? SANDBOX_REPORTS : []));
  const [deletionRequests, setDeletionRequests] = useState<AccountDeletionRequest[]>(() =>
    initialAutostart ? SANDBOX_DELETION_REQUESTS : [],
  );
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>(INITIAL_ANNOUNCEMENTS);
  const [tournaments, setTournaments] = useState<TournamentItem[]>(INITIAL_TOURNAMENTS);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AdminLogEntry[]>(() =>
    initialAutostart ? SANDBOX_ADMIN_LOGS : [],
  );
  const [sandboxMessages, setSandboxMessages] = useState<Record<string, ChatMessage[]>>(SANDBOX_MESSAGES);
  const [sandboxLeaderboards, setSandboxLeaderboards] =
    useState<Record<string, LeaderboardEntry[]>>(SANDBOX_LEADERBOARDS);

  const actor = useMemo<AdminActor | null>(() => {
    if (isSandboxMode) return SANDBOX_ACTOR;
    if (firebaseUser && isAuthorizedAdmin) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || 'admin@bwbarena.gg',
        displayName: firebaseUser.displayName || 'Super Admin',
        mode: 'firebase',
      };
    }
    return null;
  }, [isSandboxMode, firebaseUser, isAuthorizedAdmin]);

  // Ensure dark esports admin aesthetic by default
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Firebase Auth listener + /admins/{uid} authorization check
  useEffect(() => {
    if (isSandboxMode) {
      setAuthChecking(false);
      return;
    }
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (cancelled) return;
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setIsAuthorizedAdmin(false);
        setAuthChecking(false);
        return;
      }
      setAuthChecking(true);
      const ok = await adminSvc.verifyAdminAuthorization(fbUser.uid);
      if (!cancelled) {
        setIsAuthorizedAdmin(ok);
        setAuthChecking(false);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [isSandboxMode]);

  // Live Firebase RTDB subscriptions when authorized in Firebase mode
  useEffect(() => {
    if (isSandboxMode || !firebaseUser || !isAuthorizedAdmin) return;
    const unsubs: Array<() => void> = [
      adminSvc.subscribeAllUsersAdmin(setUsers),
      playerSvc.subscribeGamesCatalog(setGames),
      adminSvc.subscribeAllRoomsAdmin(setRooms),
      adminSvc.subscribeReportsAdmin(setReports),
      adminSvc.subscribeDeletionRequestsAdmin(setDeletionRequests),
      playerSvc.subscribeAnnouncements(setAnnouncements),
      playerSvc.subscribeTournaments(setTournaments),
      playerSvc.subscribePlatformSettings(setPlatformSettings),
      adminSvc.subscribeAdminLogs(setAuditLogs),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [isSandboxMode, firebaseUser, isAuthorizedAdmin]);

  const appendSandboxLog = useCallback(
    (category: AdminLogEntry['category'], action: string, target: string, details: string) => {
      const entry = buildAuditLogEntry({
        adminUid: SANDBOX_ACTOR.uid,
        adminEmail: SANDBOX_ACTOR.email,
        category,
        action,
        target,
        details,
      });
      setAuditLogs((prev) => [entry, ...prev]);
    },
    [],
  );

  // Auth Actions
  const signInAdmin = useCallback(
    async (email: string, password: string) => {
      setIsSandboxMode(false);
      const fbUser = await playerSvc.loginPlayerAccount(email, password);
      const ok = await adminSvc.verifyAdminAuthorization(fbUser.uid);
      setIsAuthorizedAdmin(ok);
      if (!ok) {
        pushToast({
          tone: 'warning',
          title: 'Admin Clearance Not Found',
          message: 'Account signed in, but UID is not listed under /admins in Realtime Database.',
        });
        return;
      }
      pushToast({ tone: 'success', title: 'Super Admin Session Verified' });
    },
    [pushToast],
  );

  const recheckAuthorization = useCallback(async () => {
    if (!firebaseUser) return false;
    setAuthChecking(true);
    const ok = await adminSvc.verifyAdminAuthorization(firebaseUser.uid);
    setIsAuthorizedAdmin(ok);
    setAuthChecking(false);
    if (ok) {
      pushToast({ tone: 'success', title: 'Admin Access Granted' });
    } else {
      pushToast({
        tone: 'warning',
        title: 'Still Unauthorized',
        message: `Add "/admins/${firebaseUser.uid}": true in Firebase Realtime Database.`,
      });
    }
    return ok;
  }, [firebaseUser, pushToast]);

  const enterSandboxMode = useCallback(() => {
    setIsSandboxMode(true);
    setUsers(SANDBOX_USERS);
    setGames(INITIAL_GAMES_CATALOG);
    setRooms(SANDBOX_ROOMS);
    setReports(SANDBOX_REPORTS);
    setDeletionRequests(SANDBOX_DELETION_REQUESTS);
    setAnnouncements(INITIAL_ANNOUNCEMENTS);
    setTournaments(INITIAL_TOURNAMENTS);
    setPlatformSettings(DEFAULT_PLATFORM_SETTINGS);
    setAuditLogs(SANDBOX_ADMIN_LOGS);
    setSandboxMessages(SANDBOX_MESSAGES);
    setSandboxLeaderboards(SANDBOX_LEADERBOARDS);
    setActiveSection('overview');
    pushToast({
      tone: 'info',
      title: 'Admin Sandbox Mode Active',
      message: 'All controls are interactive locally. Sign in with Firebase for live bwb-arena edits.',
    });
  }, [pushToast]);

  const exitSandboxMode = useCallback(() => {
    setIsSandboxMode(false);
    setUsers([]);
    setRooms([]);
    setReports([]);
    setDeletionRequests([]);
    setAuditLogs([]);
  }, []);

  const signOutAdmin = useCallback(async () => {
    if (isSandboxMode) {
      exitSandboxMode();
      pushToast({ tone: 'info', title: 'Exited Admin Sandbox' });
      return;
    }
    await playerSvc.logoutPlayerAccount(firebaseUser?.uid);
    setIsAuthorizedAdmin(false);
    pushToast({ tone: 'info', title: 'Signed Out of Admin Console' });
  }, [isSandboxMode, exitSandboxMode, firebaseUser, pushToast]);

  // -------------------------------------------------------------------------
  // Operational Admin Mutations
  // -------------------------------------------------------------------------

  const updateUserStatus = useCallback(
    async (target: PlayerProfile, status: AccountStatus, reason: string) => {
      if (!actor) return;
      if (isSandboxMode) {
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === target.uid ? { ...u, status, online: status === 'active' ? u.online : false } : u,
          ),
        );
        appendSandboxLog(
          'user',
          status === 'banned' ? 'Banned User' : status === 'suspended' ? 'Suspended User' : 'Restored User',
          `@${target.username}`,
          reason.trim() || `Status updated to ${status}.`,
        );
      } else {
        await adminSvc.adminSetUserStatus(actor, target, status, reason);
      }
      pushToast({
        tone: status === 'active' ? 'success' : 'warning',
        title: `@${target.username} marked ${status}`,
      });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const adjustUserEconomy = useCallback(
    async (
      target: PlayerProfile,
      params: { nextCoins: number; nextXp: number; nextLevel: number; coinsDelta: number; xpDelta: number; reason: string },
    ) => {
      if (!actor) return;
      if (isSandboxMode) {
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === target.uid
              ? { ...u, coins: params.nextCoins, xp: params.nextXp, level: params.nextLevel }
              : u,
          ),
        );
        appendSandboxLog(
          'economy',
          'Adjusted Coins / XP',
          `@${target.username}`,
          `Coins ${params.coinsDelta >= 0 ? '+' : ''}${params.coinsDelta} (-> ${params.nextCoins}), XP ${params.xpDelta >= 0 ? '+' : ''}${params.xpDelta} (-> ${params.nextXp}, Lvl ${params.nextLevel}). ${params.reason}`,
        );
      } else {
        await adminSvc.adminAdjustEconomy(actor, target, params);
      }
      pushToast({
        tone: 'success',
        title: `Updated @${target.username} Economy`,
        message: `${params.nextCoins.toLocaleString()} Coins · ${params.nextXp.toLocaleString()} XP (Lvl ${params.nextLevel})`,
      });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const resetUserStats = useCallback(
    async (target: PlayerProfile, reason: string) => {
      if (!actor) return;
      if (isSandboxMode) {
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === target.uid
              ? {
                  ...u,
                  gamesPlayed: 0,
                  wins: 0,
                  losses: 0,
                  draws: 0,
                  currentStreak: 0,
                  bestStreak: 0,
                  gameStats: {},
                }
              : u,
          ),
        );
        appendSandboxLog('user', 'Reset Match Stats', `@${target.username}`, reason || 'Cleared match stats.');
      } else {
        await adminSvc.adminResetPlayerStats(actor, target, reason);
      }
      pushToast({ tone: 'info', title: `Match stats cleared for @${target.username}` });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const processDeletionRequest = useCallback(
    async (req: AccountDeletionRequest, decision: 'approved' | 'rejected') => {
      if (!actor) return;
      if (isSandboxMode) {
        const now = Date.now();
        setDeletionRequests((prev) =>
          prev.map((d) =>
            d.uid === req.uid ? { ...d, status: decision, processedAt: now, processedBy: actor.email } : d,
          ),
        );
        if (decision === 'approved') {
          setUsers((prev) =>
            prev.map((u) => (u.uid === req.uid ? { ...u, status: 'banned', online: false } : u)),
          );
        }
        appendSandboxLog(
          'user',
          decision === 'approved' ? 'Approved Account Deletion' : 'Rejected Account Deletion',
          `@${req.username}`,
          `Deletion ticket ${decision}.`,
        );
      } else {
        await adminSvc.adminProcessDeletionRequest(actor, req, decision);
      }
      pushToast({
        tone: decision === 'approved' ? 'warning' : 'info',
        title: `Deletion request ${decision} for @${req.username}`,
      });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const saveGameConfig = useCallback(
    async (game: ArenaGameDefinition) => {
      if (!actor) return;
      if (isSandboxMode) {
        setGames((prev) => prev.map((g) => (g.id === game.id ? game : g)));
        appendSandboxLog(
          'game',
          'Updated Game Config',
          game.title,
          `Enabled: ${game.enabled}, Featured: ${game.featured}, MaxPlayers: ${game.maxPlayers}, Win XP: ${game.xpRewardWin}, Win Coins: ${game.coinRewardWin}.`,
        );
      } else {
        await adminSvc.adminSaveGameConfig(actor, game);
      }
      pushToast({ tone: 'success', title: `Saved ${game.title} configuration` });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const forceCloseRoom = useCallback(
    async (room: GameRoom) => {
      if (!actor) return;
      if (isSandboxMode) {
        setRooms((prev) =>
          prev.map((r) =>
            r.roomId === room.roomId ? { ...r, status: 'closed', activeSessionId: null, updatedAt: Date.now() } : r,
          ),
        );
        appendSandboxLog(
          'room',
          'Force Closed Room',
          `${room.name} (${room.code})`,
          `Disconnected ${Object.keys(room.participants).length} participant(s).`,
        );
      } else {
        await adminSvc.adminCloseRoom(actor, room);
      }
      pushToast({ tone: 'warning', title: `Room ${room.code} Force Closed` });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const kickRoomUser = useCallback(
    async (room: GameRoom, targetUid: string, targetUsername: string) => {
      if (!actor) return;
      if (isSandboxMode) {
        setRooms((prev) =>
          prev.map((r) => {
            if (r.roomId !== room.roomId) return r;
            const nextP = { ...r.participants };
            delete nextP[targetUid];
            return { ...r, participants: nextP, updatedAt: Date.now() };
          }),
        );
        appendSandboxLog('room', 'Kicked Room Participant', `@${targetUsername}`, `Removed from ${room.code}.`);
      } else {
        await adminSvc.adminKickPlayerFromRoom(actor, room, targetUid, targetUsername);
      }
      pushToast({ tone: 'info', title: `Removed @${targetUsername} from ${room.code}` });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const loadRoomMessages = useCallback(
    async (roomId: string): Promise<ChatMessage[]> => {
      if (isSandboxMode) {
        return sandboxMessages[roomId] || [];
      }
      return adminSvc.fetchRoomMessagesAdmin(roomId);
    },
    [isSandboxMode, sandboxMessages],
  );

  const deleteChatMessage = useCallback(
    async (roomId: string, messageId: string, reason: string) => {
      if (!actor) return;
      if (isSandboxMode) {
        setSandboxMessages((prev) => ({
          ...prev,
          [roomId]: (prev[roomId] || []).map((m) =>
            m.id === messageId ? { ...m, deleted: true, text: '[Removed by BWB ARENA Moderator]' } : m,
          ),
        }));
        appendSandboxLog('moderation', 'Deleted Chat Message', `Room ${roomId}`, `Removed ${messageId}. ${reason}`);
      } else {
        await adminSvc.adminDeleteChatMessage(actor, roomId, messageId, reason);
      }
      pushToast({ tone: 'warning', title: 'Chat message redacted' });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const updateReportStatus = useCallback(
    async (report: AdminReport, status: ReportStatus, note: string, deleteMessage?: boolean) => {
      if (!actor) return;
      if (isSandboxMode) {
        if (deleteMessage && report.roomId && report.messageId) {
          setSandboxMessages((prev) => ({
            ...prev,
            [report.roomId!]: (prev[report.roomId!] || []).map((m) =>
              m.id === report.messageId ? { ...m, deleted: true, text: '[Removed by BWB ARENA Moderator]' } : m,
            ),
          }));
        }
        setReports((prev) =>
          prev.map((r) =>
            r.id === report.id
              ? {
                  ...r,
                  status,
                  resolvedAt: Date.now(),
                  resolvedBy: actor.email,
                  resolutionNote: note.trim() || `Marked as ${status}`,
                  messageDeleted: Boolean(deleteMessage || r.messageDeleted),
                }
              : r,
          ),
        );
        appendSandboxLog(
          'moderation',
          status === 'resolved' ? 'Resolved Report' : 'Dismissed Report',
          `@${report.reportedUsername}`,
          `${note.trim() || status}${deleteMessage ? ' (chat message deleted)' : ''}`,
        );
      } else {
        await adminSvc.adminUpdateReportStatus(actor, report, status, note, deleteMessage);
      }
      pushToast({
        tone: status === 'resolved' ? 'success' : 'info',
        title: `Report ${status} for @${report.reportedUsername}`,
      });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const saveAnnouncement = useCallback(
    async (draft: Omit<PlatformAnnouncement, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => {
      if (!actor) return;
      if (isSandboxMode) {
        const id = draft.id || `ann_${Date.now()}`;
        const item: PlatformAnnouncement = {
          id,
          title: draft.title.trim(),
          body: draft.body.trim(),
          pinned: Boolean(draft.pinned),
          breaking: Boolean(draft.breaking),
          createdAt: draft.createdAt || Date.now(),
          authorLabel: draft.authorLabel || 'BWB ARENA HQ',
        };
        setAnnouncements((prev) => {
          const exists = prev.some((a) => a.id === id);
          const next = exists ? prev.map((a) => (a.id === id ? item : a)) : [item, ...prev];
          return next.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
        });
        appendSandboxLog(
          'announcement',
          draft.id ? 'Updated Announcement' : 'Published Announcement',
          item.title,
          `Pinned: ${item.pinned}, Breaking: ${item.breaking}`,
        );
      } else {
        await adminSvc.adminSaveAnnouncement(actor, draft);
      }
      pushToast({ tone: 'success', title: draft.id ? 'Announcement Updated' : 'Announcement Published' });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const deleteAnnouncement = useCallback(
    async (item: PlatformAnnouncement) => {
      if (!actor) return;
      if (isSandboxMode) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== item.id));
        appendSandboxLog('announcement', 'Deleted Announcement', item.title, `Removed ID ${item.id}.`);
      } else {
        await adminSvc.adminDeleteAnnouncement(actor, item);
      }
      pushToast({ tone: 'info', title: 'Announcement Deleted' });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const broadcastNotification = useCallback(
    async (targetUids: string[], payload: { title: string; body: string }) => {
      if (!actor) return;
      if (targetUids.length === 0) throw new Error('Select at least one recipient player.');
      if (isSandboxMode) {
        appendSandboxLog(
          'announcement',
          'Broadcast System Notification',
          `${targetUids.length} player(s)`,
          `${payload.title.trim()} — ${payload.body.trim().slice(0, 80)}`,
        );
      } else {
        await adminSvc.adminBroadcastSystemNotification(actor, targetUids, payload);
      }
      pushToast({
        tone: 'success',
        title: `Broadcast Dispatched`,
        message: `Delivered to ${targetUids.length} player inbox${targetUids.length === 1 ? '' : 'es'}.`,
      });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const saveTournament = useCallback(
    async (
      draft: Omit<TournamentItem, 'id' | 'registeredUids'> & {
        id?: string;
        registeredUids?: Record<string, boolean>;
      },
    ) => {
      if (!actor) return;
      if (isSandboxMode) {
        const id = draft.id || `t_${Date.now()}`;
        const item: TournamentItem = {
          id,
          title: draft.title.trim(),
          gameId: draft.gameId,
          startsAt: draft.startsAt,
          prizeCoins: draft.prizeCoins,
          prizeXp: draft.prizeXp,
          maxSlots: draft.maxSlots,
          format: draft.format.trim(),
          registeredUids: draft.registeredUids || {},
        };
        setTournaments((prev) => {
          const exists = prev.some((t) => t.id === id);
          const next = exists ? prev.map((t) => (t.id === id ? item : t)) : [...prev, item];
          return next.sort((a, b) => a.startsAt - b.startsAt);
        });
        appendSandboxLog(
          'tournament',
          draft.id ? 'Updated Tournament' : 'Created Tournament',
          item.title,
          `${item.gameId} · ${item.prizeCoins} Coins · ${item.maxSlots} slots`,
        );
      } else {
        await adminSvc.adminSaveTournament(actor, draft);
      }
      pushToast({ tone: 'success', title: draft.id ? 'Tournament Updated' : 'Tournament Created' });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const deleteTournament = useCallback(
    async (item: TournamentItem) => {
      if (!actor) return;
      if (isSandboxMode) {
        setTournaments((prev) => prev.filter((t) => t.id !== item.id));
        appendSandboxLog('tournament', 'Deleted Tournament', item.title, `Removed tournament ${item.id}.`);
      } else {
        await adminSvc.adminDeleteTournament(actor, item);
      }
      pushToast({ tone: 'info', title: `Deleted "${item.title}"` });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const subscribeBoard = useCallback(
    (boardKey: string, cb: (entries: LeaderboardEntry[]) => void) => {
      if (isSandboxMode) {
        cb(sandboxLeaderboards[boardKey] || []);
        return () => {};
      }
      return playerSvc.subscribeLeaderboard(boardKey, cb);
    },
    [isSandboxMode, sandboxLeaderboards],
  );

  const removeLeaderboardEntry = useCallback(
    async (boardKey: string, entry: LeaderboardEntry) => {
      if (!actor) return;
      if (isSandboxMode) {
        setSandboxLeaderboards((prev) => ({
          ...prev,
          [boardKey]: (prev[boardKey] || []).filter((e) => e.uid !== entry.uid),
        }));
        appendSandboxLog(
          'leaderboard',
          'Removed Leaderboard Entry',
          `@${entry.username}`,
          `Removed from "${boardKey}" board (${entry.score} pts).`,
        );
      } else {
        await adminSvc.adminRemoveLeaderboardEntry(actor, boardKey, entry);
      }
      pushToast({ tone: 'warning', title: `Removed @${entry.username} from ${boardKey}` });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const resetLeaderboard = useCallback(
    async (boardKey: string) => {
      if (!actor) return;
      if (isSandboxMode) {
        setSandboxLeaderboards((prev) => ({ ...prev, [boardKey]: [] }));
        appendSandboxLog('leaderboard', 'Reset Leaderboard', boardKey, `Cleared seasonal board "${boardKey}".`);
      } else {
        await adminSvc.adminResetLeaderboard(actor, boardKey);
      }
      pushToast({ tone: 'warning', title: `Leaderboard "${boardKey}" Reset` });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const savePlatformSettings = useCallback(
    async (next: PlatformSettings) => {
      if (!actor) return;
      if (isSandboxMode) {
        setPlatformSettings(next);
        appendSandboxLog(
          'settings',
          'Updated Platform Settings',
          next.platformName,
          `Maintenance: ${next.maintenanceMode}, Reg: ${next.registrationEnabled}, Login: ${next.loginEnabled}, Chat: ${next.chatEnabled}, PublicRooms: ${next.publicRoomsEnabled}.`,
        );
      } else {
        await adminSvc.adminSavePlatformSettings(actor, next);
      }
      pushToast({ tone: 'success', title: 'Platform Settings Saved' });
    },
    [actor, isSandboxMode, appendSandboxLog, pushToast],
  );

  const analytics = useMemo(
    () => computeAdminAnalytics({ users, rooms, reports, games }),
    [users, rooms, reports, games],
  );

  const value = useMemo<AdminContextValue>(
    () => ({
      authChecking,
      firebaseUser,
      isAuthorizedAdmin,
      isSandboxMode,
      actor,
      activeSection,
      setActiveSection,
      users,
      games,
      rooms,
      reports,
      deletionRequests,
      announcements,
      tournaments,
      platformSettings,
      auditLogs,
      analytics,
      signInAdmin,
      signOutAdmin,
      recheckAuthorization,
      enterSandboxMode,
      exitSandboxMode,
      updateUserStatus,
      adjustUserEconomy,
      resetUserStats,
      processDeletionRequest,
      saveGameConfig,
      forceCloseRoom,
      kickRoomUser,
      loadRoomMessages,
      deleteChatMessage,
      updateReportStatus,
      saveAnnouncement,
      deleteAnnouncement,
      broadcastNotification,
      saveTournament,
      deleteTournament,
      subscribeBoard,
      removeLeaderboardEntry,
      resetLeaderboard,
      savePlatformSettings,
    }),
    [
      authChecking,
      firebaseUser,
      isAuthorizedAdmin,
      isSandboxMode,
      actor,
      activeSection,
      users,
      games,
      rooms,
      reports,
      deletionRequests,
      announcements,
      tournaments,
      platformSettings,
      auditLogs,
      analytics,
      signInAdmin,
      signOutAdmin,
      recheckAuthorization,
      enterSandboxMode,
      exitSandboxMode,
      updateUserStatus,
      adjustUserEconomy,
      resetUserStats,
      processDeletionRequest,
      saveGameConfig,
      forceCloseRoom,
      kickRoomUser,
      loadRoomMessages,
      deleteChatMessage,
      updateReportStatus,
      saveAnnouncement,
      deleteAnnouncement,
      broadcastNotification,
      saveTournament,
      deleteTournament,
      subscribeBoard,
      removeLeaderboardEntry,
      resetLeaderboard,
      savePlatformSettings,
    ],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside AdminProvider');
  return ctx;
}
