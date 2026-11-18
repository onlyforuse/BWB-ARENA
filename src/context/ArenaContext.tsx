import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase/config';
import * as svc from '../firebase/arenaService';
import {
  DEFAULT_PLATFORM_SETTINGS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_GAMES_CATALOG,
  INITIAL_TOURNAMENTS,
} from '../data/catalog';
import {
  calculateLevelFromXp,
  calculateMatchRewards,
  generateRoomCode,
  isRateLimited,
  normalizeRoomCode,
  sanitizeChatMessage,
} from '../lib/gameRules';
import { arenaSound, configureSound } from '../lib/sound';
import type {
  ActiveGameSession,
  ArenaGameDefinition,
  ArenaNotification,
  ChatMessage,
  FriendRequest,
  GameId,
  GameRoom,
  LeaderboardEntry,
  MatchHistoryItem,
  PlatformAnnouncement,
  PlatformSettings,
  PlayerProfile,
  PublicPlayerSummary,
  ToastItem,
  TournamentItem,
  UserNavSection,
} from '../types/arena';

interface ArenaContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  isGuestPractice: boolean;
  player: PlayerProfile | null;
  activeNav: UserNavSection;
  setActiveNav: (section: UserNavSection) => void;
  platformSettings: PlatformSettings;
  games: ArenaGameDefinition[];
  announcements: PlatformAnnouncement[];
  tournaments: TournamentItem[];
  onlinePlayersCount: number;
  rooms: GameRoom[];
  activeRoom: GameRoom | null;
  roomMessages: ChatMessage[];
  activeSession: ActiveGameSession | null;
  friends: PublicPlayerSummary[];
  friendRequests: FriendRequest[];
  notifications: ArenaNotification[];
  unreadNotificationsCount: number;
  claimedChallenges: Record<string, number>;
  unlockedAchievements: Record<string, number>;
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Auth & Practice entry
  enterGuestPractice: () => void;
  exitGuestPractice: () => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (params: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    avatarId: string;
    avatarFile?: File | null;
  }) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;

  // Rooms & Chat
  createRoom: (params: { gameId: GameId; name: string; isPrivate: boolean; maxPlayers: number }) => Promise<GameRoom>;
  joinRoom: (roomId: string) => Promise<void>;
  joinRoomByCode: (code: string) => Promise<void>;
  leaveActiveRoom: () => Promise<void>;
  toggleReady: () => Promise<void>;
  updateRoomSettings: (patch: Partial<Pick<GameRoom, 'gameId' | 'isPrivate' | 'maxPlayers' | 'name'>>) => Promise<void>;
  kickParticipant: (uid: string) => Promise<void>;
  sendChatMessage: (text: string) => Promise<void>;
  reportMessage: (msg: ChatMessage, reason: string) => Promise<void>;

  // Game Launching & Match Completion
  launchPracticeGame: (gameId: GameId) => void;
  startRoomMatch: () => Promise<void>;
  updateSessionState: (patch: Record<string, unknown>) => Promise<void>;
  completeMatch: (result: {
    gameId: GameId;
    mode: 'multiplayer' | 'practice';
    outcome: 'win' | 'loss' | 'draw';
    score: number;
    opponentName: string;
    winnerUid?: string | null;
  }) => Promise<{ xp: number; coins: number; validatedRemotely: boolean }>;
  closeActiveSession: () => void;

  // Friends, Tournaments, Notifications, Profile, Settings, Rewards
  searchPlayers: (queryText: string) => Promise<PublicPlayerSummary[]>;
  sendFriendRequest: (target: PublicPlayerSummary) => Promise<void>;
  respondFriendRequest: (req: FriendRequest, accept: boolean) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  inviteFriendToActiveRoom: (friend: PublicPlayerSummary) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  toggleTournament: (tournamentId: string) => Promise<void>;
  claimDailyChallenge: (challengeId: string, xpReward: number, coinReward: number) => Promise<void>;
  updateProfile: (patch: { displayName?: string; bio?: string; avatarId?: string; avatarUrl?: string }) => Promise<void>;
  uploadAvatarFile: (file: File) => Promise<string>;
  updatePreferences: (patch: Partial<Pick<PlayerProfile, 'notificationPrefs' | 'privacyPrefs' | 'soundPrefs' | 'theme'>>) => Promise<void>;
  submitDeletionRequest: (reason: string) => Promise<void>;
  loadLeaderboard: (boardKey: string, cb: (entries: LeaderboardEntry[]) => void) => () => void;
}

const ArenaContext = createContext<ArenaContextValue | null>(null);

function createGuestPracticeProfile(): PlayerProfile {
  const now = Date.now();
  return {
    uid: 'guest-practice-player',
    fullName: 'Guest Competitor',
    displayName: 'Arena Challenger',
    username: 'arena_guest',
    email: 'guest@practice.bwbarena.local',
    emailVerified: false,
    avatarId: 'cyber-wolf',
    avatarUrl: '',
    bio: 'Exploring BWB ARENA in Solo Practice Mode. Create a BWB account to sync multiplayer rooms & rankings.',
    joinDate: now,
    status: 'active',
    role: 'player',
    online: true,
    lastSeen: now,
    level: 1,
    xp: 80,
    coins: 120,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
    gameStats: {},
    recentMatches: [],
    notificationPrefs: {
      friendRequests: true,
      roomInvites: true,
      announcements: true,
      tournaments: true,
      rewards: true,
    },
    privacyPrefs: {
      showOnlineStatus: true,
      allowFriendRequests: true,
      allowRoomInvites: true,
      publicProfile: true,
    },
    soundPrefs: { enabled: true, volume: 0.45 },
    theme: 'dark',
    deletionRequestedAt: null,
  };
}

export function ArenaProvider({ children }: { children: React.ReactNode }) {
  const initialAutostart =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1';

  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isGuestPractice, setIsGuestPractice] = useState(initialAutostart);
  const [player, setPlayer] = useState<PlayerProfile | null>(() =>
    initialAutostart ? createGuestPracticeProfile() : null,
  );
  const [activeNav, setActiveNav] = useState<UserNavSection>('home');

  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [games, setGames] = useState<ArenaGameDefinition[]>(INITIAL_GAMES_CATALOG);
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>(INITIAL_ANNOUNCEMENTS);
  const [tournaments, setTournaments] = useState<TournamentItem[]>(INITIAL_TOURNAMENTS);
  const [onlinePlayersCount, setOnlinePlayersCount] = useState(initialAutostart ? 1 : 0);

  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
  const [roomMessages, setRoomMessages] = useState<ChatMessage[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveGameSession | null>(null);

  const [friends, setFriends] = useState<PublicPlayerSummary[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [notifications, setNotifications] = useState<ArenaNotification[]>(() =>
    initialAutostart
      ? [
          {
            id: 'guest-welcome',
            category: 'announcement',
            title: 'Guest Practice Arena Active',
            body: 'All 5 games are playable offline against practice bots. Create a BWB account anytime for live multiplayer rooms and verified rankings.',
            createdAt: Date.now(),
            read: false,
            actionType: 'view_games',
          },
        ]
      : [],
  );
  const [claimedChallenges, setClaimedChallenges] = useState<Record<string, number>>({});
  const [unlockedAchievements, setUnlockedAchievements] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const lastChatSentRef = useRef<number>(0);

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    if (toast.tone === 'success' || toast.tone === 'info') {
      arenaSound.notification();
    }
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4400);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Apply theme & sound preferences cleanly
  useEffect(() => {
    const theme = player?.theme ?? 'dark';
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [player?.theme]);

  useEffect(() => {
    configureSound(player?.soundPrefs.enabled ?? true, player?.soundPrefs.volume ?? 0.45);
  }, [player?.soundPrefs.enabled, player?.soundPrefs.volume]);

  // Global Firebase subscriptions (settings & games library)
  useEffect(() => {
    const unsubSettings = svc.subscribePlatformSettings(setPlatformSettings);
    const unsubGames = svc.subscribeGamesCatalog(setGames);
    return () => {
      unsubSettings();
      unsubGames();
    };
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setIsGuestPractice(false);
      } else if (!isGuestPractice) {
        setPlayer(null);
      }
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, [isGuestPractice]);

  // Authenticated Firebase RTDB subscriptions
  useEffect(() => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    const unsubs: Array<() => void> = [
      svc.subscribeUserProfile(uid, firebaseUser, (p) => setPlayer(p)),
      svc.subscribeAnnouncements(setAnnouncements),
      svc.subscribeTournaments(setTournaments),
      svc.subscribeOnlinePlayerCount(setOnlinePlayersCount),
      svc.subscribePublicRooms(setRooms),
      svc.subscribeFriendsList(uid, setFriends),
      svc.subscribeFriendRequests(uid, setFriendRequests),
      svc.subscribeNotifications(uid, setNotifications),
      svc.subscribeUserAchievements(uid, (data) => {
        setClaimedChallenges(data.claimedChallenges);
        setUnlockedAchievements(data.unlockedAchievements);
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [firebaseUser]);

  // Real-time presence attachment for Firebase users
  useEffect(() => {
    if (!firebaseUser || !player) return;
    return svc.attachPlayerPresence(firebaseUser.uid, player.privacyPrefs.showOnlineStatus);
  }, [firebaseUser, player?.privacyPrefs.showOnlineStatus]);

  // Active Room & Room Chat subscriptions (Firebase mode)
  useEffect(() => {
    if (!firebaseUser || !activeRoomId) return;
    const unsubRoom = svc.subscribeRoom(activeRoomId, (room) => {
      if (!room || room.status === 'closed' || !room.participants[firebaseUser.uid]) {
        setActiveRoom(null);
        setActiveRoomId(null);
        setRoomMessages([]);
        return;
      }
      setActiveRoom(room);
      if (room.activeSessionId && (!activeSession || activeSession.sessionId !== room.activeSessionId)) {
        // Session subscription handled below
      }
    });
    const unsubChat = svc.subscribeRoomMessages(activeRoomId, setRoomMessages);
    return () => {
      unsubRoom();
      unsubChat();
    };
  }, [firebaseUser, activeRoomId]);

  // Sync active multiplayer session when room starts a game
  useEffect(() => {
    if (!firebaseUser || !activeRoom?.activeSessionId) return;
    const unsubSession = svc.subscribeGameSession(activeRoom.activeSessionId, (session) => {
      if (session && session.status === 'active') {
        setActiveSession(session);
      }
    });
    return () => unsubSession();
  }, [firebaseUser, activeRoom?.activeSessionId]);

  // Auth Actions
  const enterGuestPractice = useCallback(() => {
    setIsGuestPractice(true);
    setPlayer(createGuestPracticeProfile());
    setNotifications([
      {
        id: 'guest-welcome',
        category: 'announcement',
        title: 'Guest Practice Arena Active',
        body: 'All 5 games are playable offline against practice bots. Create a BWB account anytime for live multiplayer rooms and verified rankings.',
        createdAt: Date.now(),
        read: false,
        actionType: 'view_games',
      },
    ]);
    setOnlinePlayersCount(1);
    setActiveNav('home');
  }, []);

  const exitGuestPractice = useCallback(() => {
    setIsGuestPractice(false);
    setPlayer(null);
    setActiveRoom(null);
    setActiveRoomId(null);
    setActiveSession(null);
    setRoomMessages([]);
    setRooms([]);
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    if (!platformSettings.loginEnabled) {
      throw new Error('Player login is temporarily paused by BWB ARENA administration.');
    }
    await svc.loginPlayerAccount(email, password);
    setIsGuestPractice(false);
    pushToast({ tone: 'success', title: 'Signed in to BWB ARENA', message: 'Your profile and rooms are synced.' });
  }, [platformSettings.loginEnabled, pushToast]);

  const registerWithEmail = useCallback(
    async (params: {
      fullName: string;
      username: string;
      email: string;
      password: string;
      avatarId: string;
      avatarFile?: File | null;
    }) => {
      if (!platformSettings.registrationEnabled) {
        throw new Error('New registrations are temporarily paused.');
      }
      await svc.registerPlayerAccount(params);
      setIsGuestPractice(false);
      pushToast({
        tone: 'success',
        title: 'Account Created',
        message: 'Verification link sent to your inbox. Welcome to BWB ARENA!',
      });
    },
    [platformSettings.registrationEnabled, pushToast],
  );

  const logout = useCallback(async () => {
    if (isGuestPractice) {
      exitGuestPractice();
      pushToast({ tone: 'info', title: 'Exited Practice Arena' });
      return;
    }
    if (activeRoomId && firebaseUser) {
      await svc.leaveRoomAtomically(activeRoomId, firebaseUser.uid).catch(() => {});
    }
    await svc.logoutPlayerAccount(firebaseUser?.uid);
    setActiveRoom(null);
    setActiveRoomId(null);
    setActiveSession(null);
    setRoomMessages([]);
    pushToast({ tone: 'info', title: 'Logged out safely' });
  }, [isGuestPractice, exitGuestPractice, activeRoomId, firebaseUser, pushToast]);

  const sendPasswordReset = useCallback(async (email: string) => {
    await svc.sendPasswordReset(email);
    pushToast({ tone: 'success', title: 'Password Reset Sent', message: `Check ${email} for reset instructions.` });
  }, [pushToast]);

  const resendVerification = useCallback(async () => {
    if (isGuestPractice) {
      pushToast({ tone: 'warning', title: 'Account Required', message: 'Create a Firebase account to verify an email.' });
      return;
    }
    await svc.resendEmailVerificationLink();
    pushToast({ tone: 'success', title: 'Verification Email Sent', message: 'Inspect your inbox and spam folder.' });
  }, [isGuestPractice, pushToast]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (isGuestPractice) {
        throw new Error('Create a BWB ARENA account to manage password credentials.');
      }
      await svc.changeAccountPassword(currentPassword, newPassword);
      pushToast({ tone: 'success', title: 'Password Updated', message: 'Your Firebase password has been changed.' });
    },
    [isGuestPractice, pushToast],
  );

  // Room Actions
  const createRoom = useCallback(
    async (params: { gameId: GameId; name: string; isPrivate: boolean; maxPlayers: number }): Promise<GameRoom> => {
      if (!player) throw new Error('Sign in to create a multiplayer room.');
      if (!params.isPrivate && !platformSettings.publicRoomsEnabled) {
        throw new Error('Public rooms are currently disabled by platform settings. Try creating a Private Room.');
      }
      if (isGuestPractice) {
        const now = Date.now();
        const code = generateRoomCode();
        const localRoom: GameRoom = {
          roomId: `practice_room_${now}`,
          code,
          name: params.name.trim() || `${player.displayName}'s Lobby`,
          gameId: params.gameId,
          hostUid: player.uid,
          hostUsername: player.username,
          isPrivate: params.isPrivate,
          maxPlayers: Math.max(2, Math.min(platformSettings.maxRoomCapacity, params.maxPlayers)),
          status: 'waiting',
          createdAt: now,
          updatedAt: now,
          expiresAt: now + 1000 * 60 * 60 * 2,
          activeSessionId: null,
          participants: {
            [player.uid]: {
              uid: player.uid,
              username: player.username,
              displayName: player.displayName,
              avatarId: player.avatarId,
              avatarUrl: player.avatarUrl,
              online: true,
              ready: true,
              joinedAt: now,
            },
          },
        };
        setRooms((prev) => [localRoom, ...prev]);
        setActiveRoom(localRoom);
        setActiveRoomId(localRoom.roomId);
        setRoomMessages([]);
        pushToast({ tone: 'success', title: `Practice Lobby Created (${code})`, message: 'Sign in for cross-device multiplayer sync.' });
        return localRoom;
      }

      const room = await svc.createMultiplayerRoom({
        player,
        gameId: params.gameId,
        name: params.name,
        isPrivate: params.isPrivate,
        maxPlayers: Math.min(platformSettings.maxRoomCapacity, params.maxPlayers),
      });
      setActiveRoom(room);
      setActiveRoomId(room.roomId);
      pushToast({ tone: 'success', title: `Room ${room.code} Created`, message: 'Share the code or invite online friends.' });
      return room;
    },
    [player, platformSettings, isGuestPractice, pushToast],
  );

  const joinRoom = useCallback(
    async (roomId: string) => {
      if (!player) throw new Error('Sign in to join a room.');
      if (isGuestPractice) {
        const found = rooms.find((r) => r.roomId === roomId);
        if (!found) throw new Error('Room not found.');
        setActiveRoom(found);
        setActiveRoomId(found.roomId);
        return;
      }
      const joined = await svc.joinRoomAtomically(roomId, player);
      setActiveRoom(joined);
      setActiveRoomId(joined.roomId);
      setActiveNav('multiplayer');
      pushToast({ tone: 'success', title: `Joined ${joined.name}`, message: `Code: ${joined.code}` });
    },
    [player, isGuestPractice, rooms, pushToast],
  );

  const joinRoomByCode = useCallback(
    async (code: string) => {
      if (!player) throw new Error('Sign in to join a room by code.');
      const normalized = normalizeRoomCode(code);
      if (isGuestPractice) {
        const found = rooms.find((r) => r.code === normalized);
        if (!found) throw new Error(`No practice lobby found with code "${normalized}". Sign in to join live Firebase rooms.`);
        setActiveRoom(found);
        setActiveRoomId(found.roomId);
        setActiveNav('multiplayer');
        return;
      }
      const joined = await svc.joinRoomByCode(normalized, player);
      setActiveRoom(joined);
      setActiveRoomId(joined.roomId);
      setActiveNav('multiplayer');
      pushToast({ tone: 'success', title: `Entered Room ${joined.code}` });
    },
    [player, isGuestPractice, rooms, pushToast],
  );

  const leaveActiveRoom = useCallback(async () => {
    if (!activeRoom || !player) return;
    if (isGuestPractice) {
      setRooms((prev) => prev.filter((r) => r.roomId !== activeRoom.roomId));
      setActiveRoom(null);
      setActiveRoomId(null);
      setRoomMessages([]);
      pushToast({ tone: 'info', title: 'Left Room' });
      return;
    }
    await svc.leaveRoomAtomically(activeRoom.roomId, player.uid);
    setActiveRoom(null);
    setActiveRoomId(null);
    setRoomMessages([]);
    pushToast({ tone: 'info', title: 'Left Lobby' });
  }, [activeRoom, player, isGuestPractice, pushToast]);

  const toggleReady = useCallback(async () => {
    if (!activeRoom || !player) return;
    const current = activeRoom.participants[player.uid]?.ready ?? false;
    if (isGuestPractice) {
      setActiveRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: {
                ...prev.participants,
                [player.uid]: { ...prev.participants[player.uid], ready: !current },
              },
            }
          : null,
      );
      return;
    }
    await svc.setParticipantReady(activeRoom.roomId, player.uid, !current);
  }, [activeRoom, player, isGuestPractice]);

  const updateRoomSettings = useCallback(
    async (patch: Partial<Pick<GameRoom, 'gameId' | 'isPrivate' | 'maxPlayers' | 'name'>>) => {
      if (!activeRoom || !player || activeRoom.hostUid !== player.uid) return;
      if (isGuestPractice) {
        setActiveRoom((prev) => (prev ? { ...prev, ...patch } : null));
        setRooms((prev) => prev.map((r) => (r.roomId === activeRoom.roomId ? { ...r, ...patch } : r)));
        return;
      }
      await svc.updateRoomConfig(activeRoom.roomId, patch);
    },
    [activeRoom, player, isGuestPractice],
  );

  const kickParticipant = useCallback(
    async (uid: string) => {
      if (!activeRoom || !player || activeRoom.hostUid !== player.uid || uid === player.uid) return;
      if (isGuestPractice) return;
      await svc.kickRoomParticipant(activeRoom.roomId, uid);
      pushToast({ tone: 'info', title: 'Player Removed from Lobby' });
    },
    [activeRoom, player, isGuestPractice, pushToast],
  );

  const sendChatMessage = useCallback(
    async (text: string) => {
      if (!activeRoom || !player) return;
      if (!platformSettings.chatEnabled) {
        throw new Error('Room chat is currently disabled by platform settings.');
      }
      const now = Date.now();
      if (isRateLimited(lastChatSentRef.current, now, platformSettings.chatRateLimitMs)) {
        throw new Error('Slow down slightly — message rate limit active.');
      }
      const clean = sanitizeChatMessage(text);
      if (!clean.valid) {
        throw new Error(clean.error || 'Enter a valid message.');
      }
      lastChatSentRef.current = now;

      if (isGuestPractice) {
        const msg: ChatMessage = {
          id: `msg_${now}`,
          roomId: activeRoom.roomId,
          senderUid: player.uid,
          senderUsername: player.username,
          senderAvatarId: player.avatarId,
          senderAvatarUrl: player.avatarUrl,
          senderOnline: true,
          text: clean.text,
          createdAt: now,
        };
        setRoomMessages((prev) => [...prev, msg]);
        return;
      }
      await svc.sendRoomChatMessage(activeRoom.roomId, player, clean.text);
    },
    [activeRoom, player, platformSettings, isGuestPractice],
  );

  const reportMessage = useCallback(
    async (msg: ChatMessage, reason: string) => {
      if (!activeRoom || !player) return;
      if (!isGuestPractice) {
        await svc.reportChatMessage({
          reporterUid: player.uid,
          reporterUsername: player.username,
          roomId: activeRoom.roomId,
          message: msg,
          reason,
        });
      }
      pushToast({ tone: 'info', title: 'Report Submitted', message: 'Moderators will review this chat message.' });
    },
    [activeRoom, player, isGuestPractice, pushToast],
  );

  // Game Launching & Match Results
  const launchPracticeGame = useCallback(
    (gameId: GameId) => {
      if (!player) return;
      const gameDef = games.find((g) => g.id === gameId);
      if (!gameDef || !gameDef.enabled) {
        pushToast({ tone: 'warning', title: 'Game Unavailable', message: 'This game is currently disabled.' });
        return;
      }
      setActiveSession({
        sessionId: `practice_${gameId}_${Date.now()}`,
        roomId: activeRoom?.roomId || 'solo_practice',
        gameId,
        mode: 'practice',
        status: 'active',
        startedAt: Date.now(),
        hostUid: player.uid,
        players: {
          [player.uid]: {
            uid: player.uid,
            username: player.username,
            displayName: player.displayName,
            avatarId: player.avatarId,
            score: 0,
            wins: 0,
            ready: true,
          },
        },
        state: {},
      });
    },
    [player, games, activeRoom, pushToast],
  );

  const startRoomMatch = useCallback(async () => {
    if (!activeRoom || !player) return;
    const participantList = Object.values(activeRoom.participants);
    const gameDef = games.find((g) => g.id === activeRoom.gameId);
    if (!gameDef?.enabled) {
      throw new Error('Selected game is currently disabled.');
    }

    // If solo in room (or guest practice), start interactive practice match cleanly
    if (isGuestPractice || participantList.length < 2) {
      launchPracticeGame(activeRoom.gameId);
      return;
    }

    const initialState: Record<string, unknown> =
      activeRoom.gameId === 'tic-tac-toe'
        ? {
            board: Array(9).fill(''),
            xUid: participantList[0].uid,
            oUid: participantList[1].uid,
            turnUid: participantList[0].uid,
            round: 1,
            scores: { [participantList[0].uid]: 0, [participantList[1].uid]: 0 },
          }
        : activeRoom.gameId === 'rock-paper-scissors'
          ? {
              round: 1,
              choices: {},
              scores: Object.fromEntries(participantList.slice(0, 2).map((p) => [p.uid, 0])),
              history: [],
            }
          : {
              round: 1,
              seed: Date.now() % 10000,
              startedAt: Date.now(),
            };

    const session = await svc.startMultiplayerGameSession(activeRoom, initialState);
    setActiveSession(session);
  }, [activeRoom, player, games, isGuestPractice, launchPracticeGame]);

  const updateSessionState = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!activeSession) return;
      if (activeSession.mode === 'multiplayer' && !isGuestPractice) {
        await svc.updateGameSessionState(activeSession.sessionId, patch);
      } else {
        setActiveSession((prev) => (prev ? { ...prev, ...patch } : null));
      }
    },
    [activeSession, isGuestPractice],
  );

  const completeMatch = useCallback(
    async (result: {
      gameId: GameId;
      mode: 'multiplayer' | 'practice';
      outcome: 'win' | 'loss' | 'draw';
      score: number;
      opponentName: string;
      winnerUid?: string | null;
    }): Promise<{ xp: number; coins: number; validatedRemotely: boolean }> => {
      const reward = calculateMatchRewards({
        gameId: result.gameId,
        outcome: result.outcome,
        mode: result.mode,
        score: result.score,
      });

      const gameTitle = games.find((g) => g.id === result.gameId)?.title ?? result.gameId;
      let validatedRemotely = false;

      if (activeSession && activeSession.mode === 'multiplayer' && !isGuestPractice && activeRoom) {
        // Record match completion in RTDB so Cloud Functions trigger authoritative XP/Coins/Leaderboard updates
        await svc
          .finishMultiplayerSession(activeSession.sessionId, activeRoom.roomId, result.winnerUid ?? null)
          .then(() => {
            validatedRemotely = true;
          })
          .catch(() => {});
      }

      // Update local session view state smoothly (in Firebase production mode, locked fields remain enforced by database.rules.json + Cloud Functions)
      setPlayer((prev) => {
        if (!prev) return prev;
        const nextXp = prev.xp + reward.xp;
        const nextLevel = calculateLevelFromXp(nextXp).level;
        const nextStreak = result.outcome === 'win' ? prev.currentStreak + 1 : 0;
        const prevGame = prev.gameStats[result.gameId] || {
          played: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          bestScore: 0,
        };
        const historyItem: MatchHistoryItem = {
          id: `match_${Date.now()}`,
          gameId: result.gameId,
          gameTitle,
          mode: result.mode,
          outcome: result.outcome,
          score: result.score,
          xpEarned: reward.xp,
          coinsEarned: reward.coins,
          opponentName: result.opponentName,
          playedAt: Date.now(),
        };
        return {
          ...prev,
          xp: nextXp,
          level: nextLevel,
          coins: prev.coins + reward.coins,
          gamesPlayed: prev.gamesPlayed + 1,
          wins: prev.wins + (result.outcome === 'win' ? 1 : 0),
          losses: prev.losses + (result.outcome === 'loss' ? 1 : 0),
          draws: prev.draws + (result.outcome === 'draw' ? 1 : 0),
          currentStreak: nextStreak,
          bestStreak: Math.max(prev.bestStreak, nextStreak),
          gameStats: {
            ...prev.gameStats,
            [result.gameId]: {
              played: prevGame.played + 1,
              wins: prevGame.wins + (result.outcome === 'win' ? 1 : 0),
              losses: prevGame.losses + (result.outcome === 'loss' ? 1 : 0),
              draws: prevGame.draws + (result.outcome === 'draw' ? 1 : 0),
              bestScore: Math.max(prevGame.bestScore, result.score),
              lastPlayedAt: Date.now(),
            },
          },
          recentMatches: [historyItem, ...prev.recentMatches].slice(0, 20),
        };
      });

      return { xp: reward.xp, coins: reward.coins, validatedRemotely };
    },
    [activeSession, isGuestPractice, activeRoom, games],
  );

  const closeActiveSession = useCallback(() => {
    setActiveSession(null);
  }, []);

  // Friends, Notifications, Tournaments, Challenges, Profile, Settings
  const searchPlayers = useCallback(
    async (queryText: string) => {
      if (!player || isGuestPractice) return [];
      return svc.searchPlayers(queryText, player.uid);
    },
    [player, isGuestPractice],
  );

  const sendFriendRequest = useCallback(
    async (target: PublicPlayerSummary) => {
      if (!player) return;
      if (isGuestPractice) {
        pushToast({ tone: 'warning', title: 'Sign In Required', message: 'Create a BWB account to send friend requests.' });
        return;
      }
      await svc.sendFriendRequestToUser(player, target);
      pushToast({ tone: 'success', title: 'Friend Request Sent', message: `Sent invite to @${target.username}.` });
    },
    [player, isGuestPractice, pushToast],
  );

  const respondFriendRequest = useCallback(
    async (req: FriendRequest, accept: boolean) => {
      if (!player || isGuestPractice) return;
      await svc.respondToFriendRequest(player, req, accept);
      pushToast({
        tone: accept ? 'success' : 'info',
        title: accept ? `Added @${req.fromUsername}` : 'Request Declined',
      });
    },
    [player, isGuestPractice, pushToast],
  );

  const removeFriend = useCallback(
    async (friendUid: string) => {
      if (!player || isGuestPractice) return;
      await svc.removeFriendConnection(player.uid, friendUid);
      pushToast({ tone: 'info', title: 'Friend Removed' });
    },
    [player, isGuestPractice, pushToast],
  );

  const inviteFriendToActiveRoom = useCallback(
    async (friend: PublicPlayerSummary) => {
      if (!player || !activeRoom) {
        pushToast({ tone: 'warning', title: 'No Active Room', message: 'Create or enter a room first to invite friends.' });
        return;
      }
      if (isGuestPractice) {
        pushToast({ tone: 'info', title: 'Sign In Required', message: 'Sign in with a BWB account to send real-time invites.' });
        return;
      }
      const title = games.find((g) => g.id === activeRoom.gameId)?.title ?? activeRoom.gameId;
      await svc.inviteFriendToRoom(player, friend.uid, activeRoom, title);
      pushToast({ tone: 'success', title: `Invited @${friend.username}`, message: `Sent code ${activeRoom.code}` });
    },
    [player, activeRoom, isGuestPractice, games, pushToast],
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      if (!player) return;
      if (isGuestPractice) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        return;
      }
      await svc.markNotificationAsRead(player.uid, id);
    },
    [player, isGuestPractice],
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!player) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    if (isGuestPractice) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      return;
    }
    await svc.markAllNotificationsAsRead(player.uid, unreadIds);
  }, [player, isGuestPractice, notifications]);

  const toggleTournament = useCallback(
    async (tournamentId: string) => {
      if (!player) return;
      const target = tournaments.find((t) => t.id === tournamentId);
      if (!target) return;
      const isReg = Boolean(target.registeredUids[player.uid]);
      if (isGuestPractice) {
        setTournaments((prev) =>
          prev.map((t) => {
            if (t.id !== tournamentId) return t;
            const nextMap = { ...t.registeredUids };
            if (isReg) delete nextMap[player.uid];
            else nextMap[player.uid] = true;
            return { ...t, registeredUids: nextMap };
          }),
        );
        pushToast({
          tone: isReg ? 'info' : 'success',
          title: isReg ? 'Tournament Registration Cancelled' : `Registered for ${target.title}`,
        });
        return;
      }
      await svc.toggleTournamentRegistration(tournamentId, player.uid, !isReg);
      pushToast({
        tone: isReg ? 'info' : 'success',
        title: isReg ? 'Withdrawn from Tournament' : `Registered for ${target.title}`,
      });
    },
    [player, tournaments, isGuestPractice, pushToast],
  );

  const claimDailyChallenge = useCallback(
    async (challengeId: string, xpReward: number, coinReward: number) => {
      if (!player) return;
      if (claimedChallenges[challengeId]) return;

      if (!isGuestPractice) {
        pushToast({
          tone: 'info',
          title: 'Server Validation Required',
          message: 'Authoritative challenge claims execute via deployed Cloud Functions (firebase/functions/index.ts).',
        });
        return;
      }

      setClaimedChallenges((prev) => ({ ...prev, [challengeId]: Date.now() }));
      setPlayer((prev) => {
        if (!prev) return prev;
        const nextXp = prev.xp + xpReward;
        return {
          ...prev,
          xp: nextXp,
          level: calculateLevelFromXp(nextXp).level,
          coins: prev.coins + coinReward,
        };
      });
      pushToast({
        tone: 'success',
        title: 'Daily Challenge Claimed',
        message: `+${xpReward} XP · +${coinReward} Arena Coins`,
      });
    },
    [player, claimedChallenges, isGuestPractice, pushToast],
  );

  const updateProfile = useCallback(
    async (patch: { displayName?: string; bio?: string; avatarId?: string; avatarUrl?: string }) => {
      if (!player) return;
      if (isGuestPractice) {
        setPlayer((prev) => (prev ? { ...prev, ...patch } : null));
        pushToast({ tone: 'success', title: 'Profile Updated' });
        return;
      }
      await svc.updatePermittedProfileFields(player.uid, patch);
      pushToast({ tone: 'success', title: 'Profile Saved to Firebase' });
    },
    [player, isGuestPractice, pushToast],
  );

  const uploadAvatarFile = useCallback(
    async (file: File): Promise<string> => {
      if (!player) throw new Error('Sign in to upload an avatar.');
      if (isGuestPractice) {
        const localUrl = URL.createObjectURL(file);
        setPlayer((prev) => (prev ? { ...prev, avatarUrl: localUrl } : null));
        pushToast({ tone: 'success', title: 'Avatar Preview Updated' });
        return localUrl;
      }
      const url = await svc.uploadPlayerAvatar(player.uid, file);
      await svc.updatePermittedProfileFields(player.uid, { avatarUrl: url });
      pushToast({ tone: 'success', title: 'Avatar Uploaded' });
      return url;
    },
    [player, isGuestPractice, pushToast],
  );

  const updatePreferences = useCallback(
    async (patch: Partial<Pick<PlayerProfile, 'notificationPrefs' | 'privacyPrefs' | 'soundPrefs' | 'theme'>>) => {
      if (!player) return;
      setPlayer((prev) => (prev ? { ...prev, ...patch } : null));
      if (!isGuestPractice) {
        await svc.updatePlayerPreferences(player.uid, patch).catch(() => {});
      }
    },
    [player, isGuestPractice],
  );

  const submitDeletionRequest = useCallback(
    async (reason: string) => {
      if (!player) return;
      if (isGuestPractice) {
        setPlayer((prev) => (prev ? { ...prev, deletionRequestedAt: Date.now() } : null));
        pushToast({ tone: 'info', title: 'Practice Session Notice', message: 'Sign in with a real account to submit an account deletion ticket.' });
        return;
      }
      await svc.requestAccountDeletion(player, reason);
      pushToast({
        tone: 'info',
        title: 'Deletion Request Logged',
        message: 'BWB ARENA operations will process your account removal request.',
      });
    },
    [player, isGuestPractice, pushToast],
  );

  const loadLeaderboard = useCallback(
    (boardKey: string, cb: (entries: LeaderboardEntry[]) => void) => {
      if (isGuestPractice || !firebaseUser) {
        if (player && player.gamesPlayed > 0) {
          cb([
            {
              uid: player.uid,
              username: player.username,
              displayName: player.displayName,
              avatarId: player.avatarId,
              avatarUrl: player.avatarUrl,
              wins: player.wins,
              gamesPlayed: player.gamesPlayed,
              xp: player.xp,
              score: player.wins * 250 + player.xp,
              level: player.level,
              updatedAt: Date.now(),
            },
          ]);
        } else {
          cb([]);
        }
        return () => {};
      }
      return svc.subscribeLeaderboard(boardKey, cb);
    },
    [isGuestPractice, firebaseUser, player],
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value = useMemo<ArenaContextValue>(
    () => ({
      authReady,
      firebaseUser,
      isGuestPractice,
      player,
      activeNav,
      setActiveNav,
      platformSettings,
      games,
      announcements,
      tournaments,
      onlinePlayersCount,
      rooms,
      activeRoom,
      roomMessages,
      activeSession,
      friends,
      friendRequests,
      notifications,
      unreadNotificationsCount,
      claimedChallenges,
      unlockedAchievements,
      toasts,
      pushToast,
      dismissToast,
      enterGuestPractice,
      exitGuestPractice,
      loginWithEmail,
      registerWithEmail,
      logout,
      sendPasswordReset,
      resendVerification,
      changePassword,
      createRoom,
      joinRoom,
      joinRoomByCode,
      leaveActiveRoom,
      toggleReady,
      updateRoomSettings,
      kickParticipant,
      sendChatMessage,
      reportMessage,
      launchPracticeGame,
      startRoomMatch,
      updateSessionState,
      completeMatch,
      closeActiveSession,
      searchPlayers,
      sendFriendRequest,
      respondFriendRequest,
      removeFriend,
      inviteFriendToActiveRoom,
      markNotificationRead,
      markAllNotificationsRead,
      toggleTournament,
      claimDailyChallenge,
      updateProfile,
      uploadAvatarFile,
      updatePreferences,
      submitDeletionRequest,
      loadLeaderboard,
    }),
    [
      authReady,
      firebaseUser,
      isGuestPractice,
      player,
      activeNav,
      platformSettings,
      games,
      announcements,
      tournaments,
      onlinePlayersCount,
      rooms,
      activeRoom,
      roomMessages,
      activeSession,
      friends,
      friendRequests,
      notifications,
      unreadNotificationsCount,
      claimedChallenges,
      unlockedAchievements,
      toasts,
      pushToast,
      dismissToast,
      enterGuestPractice,
      exitGuestPractice,
      loginWithEmail,
      registerWithEmail,
      logout,
      sendPasswordReset,
      resendVerification,
      changePassword,
      createRoom,
      joinRoom,
      joinRoomByCode,
      leaveActiveRoom,
      toggleReady,
      updateRoomSettings,
      kickParticipant,
      sendChatMessage,
      reportMessage,
      launchPracticeGame,
      startRoomMatch,
      updateSessionState,
      completeMatch,
      closeActiveSession,
      searchPlayers,
      sendFriendRequest,
      respondFriendRequest,
      removeFriend,
      inviteFriendToActiveRoom,
      markNotificationRead,
      markAllNotificationsRead,
      toggleTournament,
      claimDailyChallenge,
      updateProfile,
      uploadAvatarFile,
      updatePreferences,
      submitDeletionRequest,
      loadLeaderboard,
    ],
  );

  return <ArenaContext.Provider value={value}>{children}</ArenaContext.Provider>;
}

export function useArena(): ArenaContextValue {
  const ctx = useContext(ArenaContext);
  if (!ctx) throw new Error('useArena must be used inside ArenaProvider');
  return ctx;
}
