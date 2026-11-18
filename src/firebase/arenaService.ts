import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  equalTo,
  get,
  limitToLast,
  off,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, rtdb, storage } from './config';
import {
  DEFAULT_PLATFORM_SETTINGS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_GAMES_CATALOG,
  INITIAL_TOURNAMENTS,
} from '../data/catalog';
import {
  canJoinRoom,
  generateRoomCode,
  normalizeRoomCode,
  normalizeUsername,
  sanitizeChatMessage,
} from '../lib/gameRules';
import type {
  ActiveGameSession,
  ArenaGameDefinition,
  ArenaNotification,
  ChatMessage,
  FriendRequest,
  GameId,
  GameRoom,
  LeaderboardEntry,
  PlatformAnnouncement,
  PlatformSettings,
  PlayerProfile,
  PublicPlayerSummary,
  TournamentItem,
} from '../types/arena';

// ---------------------------------------------------------------------------
// Firebase Error Formatting
// ---------------------------------------------------------------------------

export function mapFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const msg = (err as { message?: string })?.message ?? '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Double-check your credentials.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/requires-recent-login':
      return 'For security, please sign out and sign back in before completing this action.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in Firebase Console for bwb-arena.';
    case 'PERMISSION_DENIED':
      return 'Database permission denied. Ensure firebase/database.rules.json is deployed to bwb-arena.';
    default:
      if (msg.includes('PERMISSION_DENIED') || msg.includes('permission_denied')) {
        return 'Database permission denied. Deploy firebase/database.rules.json to your bwb-arena project.';
      }
      return msg || 'Operation failed. Please check your connection and try again.';
  }
}

export function buildDefaultPlayerProfile(params: {
  uid: string;
  fullName: string;
  username: string;
  email: string;
  emailVerified: boolean;
  avatarId: string;
  avatarUrl?: string;
}): PlayerProfile {
  const now = Date.now();
  return {
    uid: params.uid,
    fullName: params.fullName.trim(),
    displayName: params.fullName.trim(),
    username: normalizeUsername(params.username),
    email: params.email.trim().toLowerCase(),
    emailVerified: params.emailVerified,
    avatarId: params.avatarId || 'cyber-wolf',
    avatarUrl: params.avatarUrl || '',
    bio: 'Ready to compete in BWB ARENA.',
    joinDate: now,
    status: 'active',
    role: 'player',
    online: true,
    lastSeen: now,
    level: 1,
    xp: 0,
    coins: 0,
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
    soundPrefs: {
      enabled: true,
      volume: 0.45,
    },
    theme: 'dark',
    deletionRequestedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Authentication & Profile Creation (Zero Plaintext Password Storage)
// ---------------------------------------------------------------------------

export async function checkUsernameAvailable(rawUsername: string): Promise<boolean> {
  const uname = normalizeUsername(rawUsername);
  if (!uname) return false;
  try {
    const snap = await get(ref(rtdb, `usernames/${uname}`));
    return !snap.exists();
  } catch {
    // Allow registration flow to proceed to atomic transaction if unauthenticated read is blocked
    return true;
  }
}

export async function uploadPlayerAvatar(uid: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Select a valid PNG, JPG, or WebP image.');
  }
  if (file.size > 3 * 1024 * 1024) {
    throw new Error('Avatar image must be smaller than 3 MB.');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const fileRef = storageRef(storage, `avatars/${uid}/profile_${Date.now()}.${ext}`);
  await uploadBytes(fileRef, file, { contentType: file.type });
  return getDownloadURL(fileRef);
}

export async function registerPlayerAccount(params: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  avatarId: string;
  avatarFile?: File | null;
}): Promise<PlayerProfile> {
  const uname = normalizeUsername(params.username);

  // Pre-check username availability
  const available = await checkUsernameAvailable(uname);
  if (!available) {
    throw new Error(`Username "@${uname}" is already taken. Choose another unique handle.`);
  }

  // Create Firebase Authentication user (never store password in RTDB)
  const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
  const fbUser: User = cred.user;

  try {
    // Atomically reserve unique username in /usernames/{username}
    const unameRef = ref(rtdb, `usernames/${uname}`);
    const tx = await runTransaction(unameRef, (current) => {
      if (current !== null) return; // Abort if claimed concurrently
      return fbUser.uid;
    });

    if (!tx.committed) {
      await fbUser.delete().catch(() => {});
      throw new Error(`Username "@${uname}" was just claimed. Please choose another username.`);
    }

    let uploadedUrl = '';
    if (params.avatarFile) {
      try {
        uploadedUrl = await uploadPlayerAvatar(fbUser.uid, params.avatarFile);
      } catch {
        // Fallback smoothly to chosen avatar preset if Storage rules aren't configured yet
        uploadedUrl = '';
      }
    }

    await updateProfile(fbUser, {
      displayName: params.fullName.trim(),
      photoURL: uploadedUrl || undefined,
    }).catch(() => {});

    const profile = buildDefaultPlayerProfile({
      uid: fbUser.uid,
      fullName: params.fullName,
      username: uname,
      email: fbUser.email || params.email,
      emailVerified: fbUser.emailVerified,
      avatarId: params.avatarId,
      avatarUrl: uploadedUrl,
    });

    const publicSummary: PublicPlayerSummary = {
      uid: profile.uid,
      displayName: profile.displayName,
      username: profile.username,
      avatarId: profile.avatarId,
      avatarUrl: profile.avatarUrl || '',
      bio: profile.bio,
      level: 1,
      xp: 0,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      online: true,
      lastSeen: profile.joinDate,
      joinDate: profile.joinDate,
      status: 'active',
    };

    await update(ref(rtdb), {
      [`users/${fbUser.uid}`]: profile,
      [`publicProfiles/${fbUser.uid}`]: publicSummary,
    });

    // Send verification email
    await sendEmailVerification(fbUser).catch(() => {});

    // Welcome notification
    await push(ref(rtdb, `notifications/${fbUser.uid}`), {
      category: 'announcement',
      title: 'Welcome to BWB ARENA',
      body: 'Your account is active. Verify your email, join a live multiplayer room, and complete daily challenges.',
      createdAt: Date.now(),
      read: false,
      actionType: 'view_games',
    }).catch(() => {});

    return profile;
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function loginPlayerAccount(email: string, password: string): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return cred.user;
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function logoutPlayerAccount(uid?: string): Promise<void> {
  if (uid) {
    const now = Date.now();
    await update(ref(rtdb), {
      [`users/${uid}/online`]: false,
      [`users/${uid}/lastSeen`]: now,
      [`publicProfiles/${uid}/online`]: false,
      [`publicProfiles/${uid}/lastSeen`]: now,
    }).catch(() => {});
  }
  await signOut(auth);
}

export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function resendEmailVerificationLink(): Promise<void> {
  if (!auth.currentUser) throw new Error('Sign in first to verify your email.');
  try {
    await sendEmailVerification(auth.currentUser);
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function changeAccountPassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No authenticated email account found.');
  try {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

// ---------------------------------------------------------------------------
// Real-Time Online Presence (.info/connected + onDisconnect)
// ---------------------------------------------------------------------------

export function attachPlayerPresence(uid: string, showOnline: boolean): () => void {
  const connectedRef = ref(rtdb, '.info/connected');
  const userOnlineRef = ref(rtdb, `users/${uid}/online`);
  const userSeenRef = ref(rtdb, `users/${uid}/lastSeen`);
  const pubOnlineRef = ref(rtdb, `publicProfiles/${uid}/online`);
  const pubSeenRef = ref(rtdb, `publicProfiles/${uid}/lastSeen`);

  const handler = onValue(connectedRef, (snap) => {
    if (snap.val() !== true) return;
    onDisconnect(userOnlineRef).set(false).catch(() => {});
    onDisconnect(userSeenRef).set(serverTimestamp()).catch(() => {});
    onDisconnect(pubOnlineRef).set(false).catch(() => {});
    onDisconnect(pubSeenRef).set(serverTimestamp()).catch(() => {});

    set(userOnlineRef, showOnline).catch(() => {});
    set(userSeenRef, serverTimestamp()).catch(() => {});
    set(pubOnlineRef, showOnline).catch(() => {});
    set(pubSeenRef, serverTimestamp()).catch(() => {});
  });

  return () => {
    off(connectedRef, 'value', handler);
  };
}

// ---------------------------------------------------------------------------
// Real-Time Subscriptions (Clean Unsubscribe Returned on All)
// ---------------------------------------------------------------------------

export function subscribePlatformSettings(cb: (settings: PlatformSettings) => void): () => void {
  const settingsRef = ref(rtdb, 'platformSettings');
  const unsub = onValue(
    settingsRef,
    (snap) => {
      if (snap.exists()) {
        cb({ ...DEFAULT_PLATFORM_SETTINGS, ...snap.val() });
      } else {
        cb(DEFAULT_PLATFORM_SETTINGS);
      }
    },
    () => cb(DEFAULT_PLATFORM_SETTINGS),
  );
  return () => unsub();
}

export function subscribeGamesCatalog(cb: (games: ArenaGameDefinition[]) => void): () => void {
  const gamesRef = ref(rtdb, 'games');
  const unsub = onValue(
    gamesRef,
    (snap) => {
      if (!snap.exists()) {
        cb(INITIAL_GAMES_CATALOG);
        return;
      }
      const raw = snap.val() as Record<string, Partial<ArenaGameDefinition>>;
      // Merge Firebase admin overrides onto implemented game definitions so unimplemented titles never appear playable
      const merged = INITIAL_GAMES_CATALOG.map((base) => {
        const remote = raw[base.id];
        if (!remote) return base;
        return {
          ...base,
          ...remote,
          id: base.id,
          instructions: Array.isArray(remote.instructions) && remote.instructions.length > 0 ? remote.instructions : base.instructions,
          thumbnail: remote.thumbnail || base.thumbnail,
        };
      });
      cb(merged);
    },
    () => cb(INITIAL_GAMES_CATALOG),
  );
  return () => unsub();
}

export function subscribeAnnouncements(cb: (items: PlatformAnnouncement[]) => void): () => void {
  const annRef = ref(rtdb, 'announcements');
  const unsub = onValue(
    annRef,
    (snap) => {
      if (!snap.exists()) {
        cb(INITIAL_ANNOUNCEMENTS);
        return;
      }
      const list = Object.entries(snap.val() as Record<string, PlatformAnnouncement>)
        .map(([id, item]) => ({ ...item, id }))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.createdAt || 0) - (a.createdAt || 0));
      cb(list.length > 0 ? list : INITIAL_ANNOUNCEMENTS);
    },
    () => cb(INITIAL_ANNOUNCEMENTS),
  );
  return () => unsub();
}

export function subscribeTournaments(cb: (items: TournamentItem[]) => void): () => void {
  const tRef = ref(rtdb, 'tournaments');
  const unsub = onValue(
    tRef,
    (snap) => {
      if (!snap.exists()) {
        cb(INITIAL_TOURNAMENTS);
        return;
      }
      const list = Object.entries(snap.val() as Record<string, TournamentItem>)
        .map(([id, t]) => ({ ...t, id, registeredUids: t.registeredUids || {} }))
        .sort((a, b) => a.startsAt - b.startsAt);
      cb(list.length > 0 ? list : INITIAL_TOURNAMENTS);
    },
    () => cb(INITIAL_TOURNAMENTS),
  );
  return () => unsub();
}

export function subscribeUserProfile(
  uid: string,
  fbUser: User,
  cb: (profile: PlayerProfile | null) => void,
): () => void {
  const userRef = ref(rtdb, `users/${uid}`);
  const unsub = onValue(
    userRef,
    async (snap) => {
      if (snap.exists()) {
        const val = snap.val() as Partial<PlayerProfile>;
        const defaults = buildDefaultPlayerProfile({
          uid,
          fullName: val.fullName || fbUser.displayName || 'Player',
          username: val.username || `player_${uid.slice(0, 6).toLowerCase()}`,
          email: fbUser.email || val.email || '',
          emailVerified: fbUser.emailVerified,
          avatarId: val.avatarId || 'cyber-wolf',
          avatarUrl: val.avatarUrl || fbUser.photoURL || '',
        });
        cb({
          ...defaults,
          ...val,
          emailVerified: fbUser.emailVerified,
          notificationPrefs: { ...defaults.notificationPrefs, ...(val.notificationPrefs || {}) },
          privacyPrefs: { ...defaults.privacyPrefs, ...(val.privacyPrefs || {}) },
          soundPrefs: { ...defaults.soundPrefs, ...(val.soundPrefs || {}) },
          gameStats: val.gameStats || {},
          recentMatches: Array.isArray(val.recentMatches)
            ? val.recentMatches
            : val.recentMatches
              ? Object.values(val.recentMatches as Record<string, PlayerProfile['recentMatches'][number]>)
              : [],
        });
      } else {
        // Bootstrap missing profile record cleanly for existing Firebase Auth users
        const fallbackUsername = `player_${uid.slice(0, 6).toLowerCase()}`;
        const fresh = buildDefaultPlayerProfile({
          uid,
          fullName: fbUser.displayName || 'Arena Player',
          username: fallbackUsername,
          email: fbUser.email || '',
          emailVerified: fbUser.emailVerified,
          avatarId: 'cyber-wolf',
          avatarUrl: fbUser.photoURL || '',
        });
        set(userRef, fresh).catch(() => {});
        cb(fresh);
      }
    },
    () => {
      // Fallback if RTDB rules block read before deployment
      const fallback = buildDefaultPlayerProfile({
        uid,
        fullName: fbUser.displayName || 'Arena Player',
        username: `player_${uid.slice(0, 6).toLowerCase()}`,
        email: fbUser.email || '',
        emailVerified: fbUser.emailVerified,
        avatarId: 'cyber-wolf',
        avatarUrl: fbUser.photoURL || '',
      });
      cb(fallback);
    },
  );
  return () => unsub();
}

export function subscribeOnlinePlayerCount(cb: (count: number) => void): () => void {
  const q = query(ref(rtdb, 'publicProfiles'), orderByChild('online'), equalTo(true));
  const unsub = onValue(
    q,
    (snap) => {
      if (!snap.exists()) {
        cb(0);
        return;
      }
      cb(Object.keys(snap.val() as Record<string, unknown>).length);
    },
    () => cb(0),
  );
  return () => unsub();
}

export function subscribePublicRooms(cb: (rooms: GameRoom[]) => void): () => void {
  const roomsRef = ref(rtdb, 'rooms');
  const unsub = onValue(
    roomsRef,
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const now = Date.now();
      const rooms = Object.entries(snap.val() as Record<string, GameRoom>)
        .map(([roomId, r]) => ({ ...r, roomId, participants: r.participants || {} }))
        .filter((r) => r.status !== 'closed' && (!r.expiresAt || r.expiresAt > now))
        .sort((a, b) => b.createdAt - a.createdAt);
      cb(rooms);
    },
    () => cb([]),
  );
  return () => unsub();
}

export function subscribeRoom(roomId: string, cb: (room: GameRoom | null) => void): () => void {
  const rRef = ref(rtdb, `rooms/${roomId}`);
  const unsub = onValue(
    rRef,
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const val = snap.val() as GameRoom;
      cb({ ...val, roomId, participants: val.participants || {} });
    },
    () => cb(null),
  );
  return () => unsub();
}

export function subscribeRoomMessages(roomId: string, cb: (msgs: ChatMessage[]) => void): () => void {
  const q = query(ref(rtdb, `messages/${roomId}`), limitToLast(80));
  const unsub = onValue(
    q,
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const list = Object.entries(snap.val() as Record<string, ChatMessage>)
        .map(([id, m]) => ({ ...m, id }))
        .filter((m) => !m.deleted)
        .sort((a, b) => a.createdAt - b.createdAt);
      cb(list);
    },
    () => cb([]),
  );
  return () => unsub();
}

export function subscribeNotifications(uid: string, cb: (items: ArenaNotification[]) => void): () => void {
  const q = query(ref(rtdb, `notifications/${uid}`), limitToLast(50));
  const unsub = onValue(
    q,
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const list = Object.entries(snap.val() as Record<string, ArenaNotification>)
        .map(([id, n]) => ({ ...n, id }))
        .sort((a, b) => b.createdAt - a.createdAt);
      cb(list);
    },
    () => cb([]),
  );
  return () => unsub();
}

export function subscribeFriendsList(uid: string, cb: (friends: PublicPlayerSummary[]) => void): () => void {
  const fRef = ref(rtdb, `friends/${uid}`);
  const unsub = onValue(
    fRef,
    async (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const friendUids = Object.keys(snap.val() as Record<string, boolean>);
      const summaries = await Promise.all(
        friendUids.map(async (fUid) => {
          const pSnap = await get(ref(rtdb, `publicProfiles/${fUid}`)).catch(() => null);
          if (pSnap && pSnap.exists()) {
            return pSnap.val() as PublicPlayerSummary;
          }
          return null;
        }),
      );
      cb(summaries.filter((x): x is PublicPlayerSummary => x !== null));
    },
    () => cb([]),
  );
  return () => unsub();
}

export function subscribeFriendRequests(uid: string, cb: (reqs: FriendRequest[]) => void): () => void {
  const reqRef = ref(rtdb, `friendRequests/${uid}`);
  const unsub = onValue(
    reqRef,
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const list = Object.entries(snap.val() as Record<string, FriendRequest>)
        .map(([id, r]) => ({ ...r, id }))
        .filter((r) => r.status === 'pending')
        .sort((a, b) => b.createdAt - a.createdAt);
      cb(list);
    },
    () => cb([]),
  );
  return () => unsub();
}

export function subscribeLeaderboard(
  boardKey: string,
  cb: (entries: LeaderboardEntry[]) => void,
): () => void {
  const bRef = ref(rtdb, `leaderboards/${boardKey}`);
  const unsub = onValue(
    bRef,
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const list = Object.entries(snap.val() as Record<string, LeaderboardEntry>)
        .map(([uid, entry]) => ({ ...entry, uid }))
        .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.wins || 0) - (a.wins || 0) || (b.xp || 0) - (a.xp || 0));
      cb(list);
    },
    () => cb([]),
  );
  return () => unsub();
}

export function subscribeGameSession(
  sessionId: string,
  cb: (session: ActiveGameSession | null) => void,
): () => void {
  const sRef = ref(rtdb, `gameSessions/${sessionId}`);
  const unsub = onValue(
    sRef,
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      cb(snap.val() as ActiveGameSession);
    },
    () => cb(null),
  );
  return () => unsub();
}

export function subscribeUserAchievements(
  uid: string,
  cb: (data: { claimedChallenges: Record<string, number>; unlockedAchievements: Record<string, number> }) => void,
): () => void {
  const aRef = ref(rtdb, `achievements/${uid}`);
  const unsub = onValue(
    aRef,
    (snap) => {
      if (!snap.exists()) {
        cb({ claimedChallenges: {}, unlockedAchievements: {} });
        return;
      }
      const v = snap.val();
      cb({
        claimedChallenges: v.claimedChallenges || {},
        unlockedAchievements: v.unlockedAchievements || {},
      });
    },
    () => cb({ claimedChallenges: {}, unlockedAchievements: {} }),
  );
  return () => unsub();
}

// ---------------------------------------------------------------------------
// Multiplayer Rooms (Atomic Transactions to Prevent Join Race Conditions)
// ---------------------------------------------------------------------------

export async function createMultiplayerRoom(params: {
  player: PlayerProfile;
  gameId: GameId;
  name: string;
  isPrivate: boolean;
  maxPlayers: number;
}): Promise<GameRoom> {
  const newRoomRef = push(ref(rtdb, 'rooms'));
  const roomId = newRoomRef.key!;
  const code = generateRoomCode();
  const now = Date.now();

  const room: GameRoom = {
    roomId,
    code,
    name: params.name.trim() || `${params.player.displayName}'s Lobby`,
    gameId: params.gameId,
    hostUid: params.player.uid,
    hostUsername: params.player.username,
    isPrivate: params.isPrivate,
    maxPlayers: Math.max(2, Math.min(8, params.maxPlayers)),
    status: 'waiting',
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 1000 * 60 * 60 * 3, // 3-hour automatic expiration
    activeSessionId: null,
    participants: {
      [params.player.uid]: {
        uid: params.player.uid,
        username: params.player.username,
        displayName: params.player.displayName,
        avatarId: params.player.avatarId,
        avatarUrl: params.player.avatarUrl || '',
        online: true,
        ready: true,
        joinedAt: now,
      },
    },
  };

  try {
    await set(newRoomRef, room);
    return room;
  } catch (err) {
    throw new Error(mapFirebaseError(err));
  }
}

export async function joinRoomAtomically(roomId: string, player: PlayerProfile): Promise<GameRoom> {
  const roomRef = ref(rtdb, `rooms/${roomId}`);
  let rejectReason = 'Unable to join room.';

  const result = await runTransaction(roomRef, (current: GameRoom | null) => {
    if (!current) {
      rejectReason = 'Room does not exist or has expired.';
      return; // Abort transaction
    }
    const participants = current.participants || {};
    const alreadyInRoom = Boolean(participants[player.uid]);
    const check = canJoinRoom({
      status: current.status,
      currentCount: Object.keys(participants).length,
      maxPlayers: current.maxPlayers,
      alreadyInRoom,
    });

    if (!check.allowed) {
      rejectReason = check.reason || 'Room cannot be joined.';
      return; // Abort transaction
    }

    current.participants = {
      ...participants,
      [player.uid]: {
        uid: player.uid,
        username: player.username,
        displayName: player.displayName,
        avatarId: player.avatarId,
        avatarUrl: player.avatarUrl || '',
        online: true,
        ready: alreadyInRoom ? participants[player.uid].ready : false,
        joinedAt: alreadyInRoom ? participants[player.uid].joinedAt : Date.now(),
      },
    };
    current.updatedAt = Date.now();
    return current;
  });

  if (!result.committed || !result.snapshot.exists()) {
    throw new Error(rejectReason);
  }
  return result.snapshot.val() as GameRoom;
}

export async function joinRoomByCode(rawCode: string, player: PlayerProfile): Promise<GameRoom> {
  const code = normalizeRoomCode(rawCode);
  if (code.length < 4) {
    throw new Error('Enter a valid 6-character room code.');
  }
  const q = query(ref(rtdb, 'rooms'), orderByChild('code'), equalTo(code));
  const snap = await get(q);
  if (!snap.exists()) {
    throw new Error(`No active room found with code "${code}".`);
  }
  const entries = Object.entries(snap.val() as Record<string, GameRoom>);
  const active = entries.find(([, r]) => r.status !== 'closed');
  if (!active) {
    throw new Error('That room has already been closed.');
  }
  return joinRoomAtomically(active[0], player);
}

export async function leaveRoomAtomically(roomId: string, uid: string): Promise<void> {
  const roomRef = ref(rtdb, `rooms/${roomId}`);
  await runTransaction(roomRef, (current: GameRoom | null) => {
    if (!current || !current.participants) return current;
    delete current.participants[uid];
    const remainingIds = Object.keys(current.participants);
    if (remainingIds.length === 0) {
      // Auto-cleanup empty room
      return null;
    }
    if (current.hostUid === uid) {
      const nextHost = current.participants[remainingIds[0]];
      current.hostUid = nextHost.uid;
      current.hostUsername = nextHost.username;
      current.participants[nextHost.uid].ready = true;
    }
    current.updatedAt = Date.now();
    return current;
  });
}

export async function setParticipantReady(roomId: string, uid: string, ready: boolean): Promise<void> {
  await update(ref(rtdb, `rooms/${roomId}`), {
    [`participants/${uid}/ready`]: ready,
    updatedAt: Date.now(),
  });
}

export async function updateRoomConfig(
  roomId: string,
  patch: Partial<Pick<GameRoom, 'gameId' | 'isPrivate' | 'maxPlayers' | 'name'>>,
): Promise<void> {
  await update(ref(rtdb, `rooms/${roomId}`), {
    ...patch,
    updatedAt: Date.now(),
  });
}

export async function kickRoomParticipant(roomId: string, targetUid: string): Promise<void> {
  await remove(ref(rtdb, `rooms/${roomId}/participants/${targetUid}`));
  await push(ref(rtdb, `notifications/${targetUid}`), {
    category: 'room_invite',
    title: 'Removed from Room',
    body: 'The room host removed you from the lobby.',
    createdAt: Date.now(),
    read: false,
  }).catch(() => {});
}

export async function startMultiplayerGameSession(
  room: GameRoom,
  initialState: Record<string, unknown>,
): Promise<ActiveGameSession> {
  const sessionRef = push(ref(rtdb, 'gameSessions'));
  const sessionId = sessionRef.key!;
  const players: ActiveGameSession['players'] = {};
  Object.values(room.participants).forEach((p) => {
    players[p.uid] = {
      uid: p.uid,
      username: p.username,
      displayName: p.displayName,
      avatarId: p.avatarId,
      score: 0,
      wins: 0,
      ready: true,
    };
  });

  const session: ActiveGameSession = {
    sessionId,
    roomId: room.roomId,
    gameId: room.gameId,
    mode: 'multiplayer',
    status: 'active',
    startedAt: Date.now(),
    hostUid: room.hostUid,
    players,
    state: initialState,
  };

  await update(ref(rtdb), {
    [`gameSessions/${sessionId}`]: session,
    [`rooms/${room.roomId}/status`]: 'in_game',
    [`rooms/${room.roomId}/activeSessionId`]: sessionId,
    [`rooms/${room.roomId}/updatedAt`]: Date.now(),
  });

  return session;
}

export async function updateGameSessionState(
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await update(ref(rtdb, `gameSessions/${sessionId}`), patch);
}

export async function finishMultiplayerSession(
  sessionId: string,
  roomId: string,
  winnerUid: string | null,
): Promise<void> {
  await update(ref(rtdb), {
    [`gameSessions/${sessionId}/status`]: 'finished',
    [`gameSessions/${sessionId}/finishedAt`]: Date.now(),
    [`gameSessions/${sessionId}/winnerUid`]: winnerUid,
    [`rooms/${roomId}/status`]: 'waiting',
    [`rooms/${roomId}/activeSessionId`]: null,
    [`rooms/${roomId}/updatedAt`]: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Room Chat & Moderation Reporting
// ---------------------------------------------------------------------------

export async function sendRoomChatMessage(
  roomId: string,
  player: PlayerProfile,
  rawText: string,
): Promise<void> {
  const check = sanitizeChatMessage(rawText);
  if (!check.valid) throw new Error(check.error || 'Invalid message.');

  await push(ref(rtdb, `messages/${roomId}`), {
    roomId,
    senderUid: player.uid,
    senderUsername: player.username,
    senderAvatarId: player.avatarId,
    senderAvatarUrl: player.avatarUrl || '',
    senderOnline: true,
    text: check.text,
    createdAt: Date.now(),
  });
}

export async function reportChatMessage(params: {
  reporterUid: string;
  reporterUsername: string;
  roomId: string;
  message: ChatMessage;
  reason: string;
}): Promise<void> {
  await push(ref(rtdb, 'reports'), {
    type: 'chat_message',
    status: 'open',
    roomId: params.roomId,
    messageId: params.message.id,
    messageText: params.message.text,
    reportedUid: params.message.senderUid,
    reportedUsername: params.message.senderUsername,
    reporterUid: params.reporterUid,
    reporterUsername: params.reporterUsername,
    reason: params.reason.trim() || 'Inappropriate message',
    createdAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Friends & Invitations
// ---------------------------------------------------------------------------

export async function searchPlayers(searchTerm: string, currentUid: string): Promise<PublicPlayerSummary[]> {
  const clean = normalizeUsername(searchTerm);
  if (clean.length < 2) return [];
  const snap = await get(ref(rtdb, 'publicProfiles'));
  if (!snap.exists()) return [];
  const all = Object.values(snap.val() as Record<string, PublicPlayerSummary>);
  return all
    .filter(
      (p) =>
        p.uid !== currentUid &&
        (p.username.toLowerCase().includes(clean) || p.displayName.toLowerCase().includes(clean)),
    )
    .slice(0, 12);
}

export async function sendFriendRequestToUser(from: PlayerProfile, target: PublicPlayerSummary): Promise<void> {
  const reqId = `${from.uid}_${target.uid}`;
  const reqData: FriendRequest = {
    id: reqId,
    fromUid: from.uid,
    fromUsername: from.username,
    fromDisplayName: from.displayName,
    fromAvatarId: from.avatarId,
    fromAvatarUrl: from.avatarUrl || '',
    toUid: target.uid,
    status: 'pending',
    createdAt: Date.now(),
  };

  await update(ref(rtdb), {
    [`friendRequests/${target.uid}/${reqId}`]: reqData,
  });

  await push(ref(rtdb, `notifications/${target.uid}`), {
    category: 'friend_request',
    title: 'New Friend Request',
    body: `${from.displayName} (@${from.username}) wants to connect with you.`,
    createdAt: Date.now(),
    read: false,
    actionType: 'view_friends',
  }).catch(() => {});
}

export async function respondToFriendRequest(
  currentPlayer: PlayerProfile,
  request: FriendRequest,
  accept: boolean,
): Promise<void> {
  const updates: Record<string, unknown> = {
    [`friendRequests/${currentPlayer.uid}/${request.id}`]: null,
  };
  if (accept) {
    updates[`friends/${currentPlayer.uid}/${request.fromUid}`] = true;
    updates[`friends/${request.fromUid}/${currentPlayer.uid}`] = true;
  }
  await update(ref(rtdb), updates);

  if (accept) {
    await push(ref(rtdb, `notifications/${request.fromUid}`), {
      category: 'friend_request',
      title: 'Friend Request Accepted',
      body: `${currentPlayer.displayName} (@${currentPlayer.username}) accepted your friend request.`,
      createdAt: Date.now(),
      read: false,
      actionType: 'view_friends',
    }).catch(() => {});
  }
}

export async function removeFriendConnection(uid: string, friendUid: string): Promise<void> {
  await update(ref(rtdb), {
    [`friends/${uid}/${friendUid}`]: null,
    [`friends/${friendUid}/${uid}`]: null,
  });
}

export async function inviteFriendToRoom(
  from: PlayerProfile,
  friendUid: string,
  room: GameRoom,
  gameTitle: string,
): Promise<void> {
  await push(ref(rtdb, `notifications/${friendUid}`), {
    category: 'room_invite',
    title: `Room Invite · ${gameTitle}`,
    body: `${from.displayName} invited you to join "${room.name}" (Code: ${room.code}).`,
    createdAt: Date.now(),
    read: false,
    actionType: 'join_room',
    actionPayload: room.code,
  });
}

// ---------------------------------------------------------------------------
// Notifications, Tournaments, Profile & Settings Updates
// ---------------------------------------------------------------------------

export async function markNotificationAsRead(uid: string, notifId: string): Promise<void> {
  await update(ref(rtdb, `notifications/${uid}/${notifId}`), { read: true });
}

export async function markAllNotificationsAsRead(uid: string, notifIds: string[]): Promise<void> {
  const updates: Record<string, boolean> = {};
  notifIds.forEach((id) => {
    updates[`notifications/${uid}/${id}/read`] = true;
  });
  if (Object.keys(updates).length > 0) {
    await update(ref(rtdb), updates);
  }
}

export async function toggleTournamentRegistration(
  tournamentId: string,
  uid: string,
  register: boolean,
): Promise<void> {
  await set(ref(rtdb, `tournaments/${tournamentId}/registeredUids/${uid}`), register ? true : null);
}

export async function updatePermittedProfileFields(
  uid: string,
  patch: { displayName?: string; bio?: string; avatarId?: string; avatarUrl?: string },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (patch.displayName !== undefined) {
    updates[`users/${uid}/displayName`] = patch.displayName.trim();
    updates[`publicProfiles/${uid}/displayName`] = patch.displayName.trim();
  }
  if (patch.bio !== undefined) {
    updates[`users/${uid}/bio`] = patch.bio.trim().slice(0, 180);
    updates[`publicProfiles/${uid}/bio`] = patch.bio.trim().slice(0, 180);
  }
  if (patch.avatarId !== undefined) {
    updates[`users/${uid}/avatarId`] = patch.avatarId;
    updates[`publicProfiles/${uid}/avatarId`] = patch.avatarId;
  }
  if (patch.avatarUrl !== undefined) {
    updates[`users/${uid}/avatarUrl`] = patch.avatarUrl;
    updates[`publicProfiles/${uid}/avatarUrl`] = patch.avatarUrl;
  }
  if (Object.keys(updates).length > 0) {
    await update(ref(rtdb), updates);
  }
}

export async function updatePlayerPreferences(
  uid: string,
  patch: Partial<Pick<PlayerProfile, 'notificationPrefs' | 'privacyPrefs' | 'soundPrefs' | 'theme'>>,
): Promise<void> {
  await update(ref(rtdb, `users/${uid}`), patch);
}

export async function requestAccountDeletion(player: PlayerProfile, reason: string): Promise<void> {
  const now = Date.now();
  await update(ref(rtdb), {
    [`deletionRequests/${player.uid}`]: {
      uid: player.uid,
      username: player.username,
      email: player.email,
      reason: reason.trim() || 'User requested account deletion',
      requestedAt: now,
      status: 'pending',
    },
    [`users/${player.uid}/deletionRequestedAt`]: now,
  });
}
