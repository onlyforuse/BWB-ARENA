export type GameId =
  | 'can-you-guess'
  | 'quiz-battle'
  | 'tic-tac-toe'
  | 'rock-paper-scissors'
  | 'word-battle';

export type UserNavSection =
  | 'home'
  | 'games'
  | 'multiplayer'
  | 'friends'
  | 'leaderboard'
  | 'achievements'
  | 'notifications'
  | 'profile'
  | 'settings';

export type AccountStatus = 'active' | 'suspended' | 'banned';

export interface NotificationPrefs {
  friendRequests: boolean;
  roomInvites: boolean;
  announcements: boolean;
  tournaments: boolean;
  rewards: boolean;
}

export interface PrivacyPrefs {
  showOnlineStatus: boolean;
  allowFriendRequests: boolean;
  allowRoomInvites: boolean;
  publicProfile: boolean;
}

export interface SoundPrefs {
  enabled: boolean;
  volume: number; // 0 to 1
}

export interface GameStatsRecord {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  bestScore: number;
  lastPlayedAt?: number;
}

export interface MatchHistoryItem {
  id: string;
  gameId: GameId;
  gameTitle: string;
  mode: 'multiplayer' | 'practice';
  outcome: 'win' | 'loss' | 'draw';
  score: number;
  xpEarned: number;
  coinsEarned: number;
  opponentName: string;
  playedAt: number;
}

export interface PlayerProfile {
  uid: string;
  fullName: string;
  displayName: string;
  username: string;
  email: string;
  emailVerified: boolean;
  avatarId: string;
  avatarUrl?: string;
  bio: string;
  joinDate: number;
  status: AccountStatus;
  role: 'player' | 'admin';
  online: boolean;
  lastSeen: number;
  level: number;
  xp: number;
  coins: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
  gameStats: Partial<Record<GameId, GameStatsRecord>>;
  recentMatches: MatchHistoryItem[];
  notificationPrefs: NotificationPrefs;
  privacyPrefs: PrivacyPrefs;
  soundPrefs: SoundPrefs;
  theme: 'dark' | 'light';
  deletionRequestedAt?: number | null;
}

export interface PublicPlayerSummary {
  uid: string;
  displayName: string;
  username: string;
  avatarId: string;
  avatarUrl?: string;
  bio: string;
  level: number;
  xp: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  online: boolean;
  lastSeen: number;
  joinDate: number;
  status?: AccountStatus;
}

export interface ArenaGameDefinition {
  id: GameId;
  title: string;
  shortTitle: string;
  category: 'Creative' | 'Trivia' | 'Strategy' | 'Arcade' | 'Word';
  description: string;
  thumbnail: string;
  minPlayers: number;
  maxPlayers: number;
  enabled: boolean;
  featured: boolean;
  trending: boolean;
  statusLabel: 'Live' | 'Featured' | 'Maintenance';
  avgDuration: string;
  xpRewardWin: number;
  coinRewardWin: number;
  instructions: string[];
  activePlayersCount?: number;
}

export interface RoomParticipant {
  uid: string;
  username: string;
  displayName: string;
  avatarId: string;
  avatarUrl?: string;
  online: boolean;
  ready: boolean;
  joinedAt: number;
  score?: number;
}

export type RoomStatus = 'waiting' | 'in_game' | 'finished' | 'closed';

export interface GameRoom {
  roomId: string;
  code: string;
  name: string;
  gameId: GameId;
  hostUid: string;
  hostUsername: string;
  isPrivate: boolean;
  maxPlayers: number;
  status: RoomStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  activeSessionId?: string | null;
  participants: Record<string, RoomParticipant>;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderUid: string;
  senderUsername: string;
  senderAvatarId: string;
  senderAvatarUrl?: string;
  senderOnline?: boolean;
  text: string;
  createdAt: number;
  deleted?: boolean;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromUsername: string;
  fromDisplayName: string;
  fromAvatarId: string;
  fromAvatarUrl?: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export type NotificationCategory =
  | 'friend_request'
  | 'room_invite'
  | 'game_invite'
  | 'announcement'
  | 'tournament'
  | 'reward'
  | 'admin_notice';

export interface ArenaNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  actionType?: 'join_room' | 'view_friends' | 'view_achievements' | 'view_games';
  actionPayload?: string;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  breaking?: boolean;
  createdAt: number;
  authorLabel?: string;
}

export interface TournamentItem {
  id: string;
  title: string;
  gameId: GameId;
  startsAt: number;
  prizeCoins: number;
  prizeXp: number;
  maxSlots: number;
  registeredUids: Record<string, boolean>;
  format: string;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  target: number;
  metric: 'games_played' | 'wins' | 'chat_messages' | 'word_or_quiz';
  xpReward: number;
  coinReward: number;
  gameId?: GameId;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  coinReward: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Apex';
  target: number;
  metric: 'wins' | 'gamesPlayed' | 'level' | 'friends' | 'streak';
}

export interface LeaderboardEntry {
  uid: string;
  username: string;
  displayName: string;
  avatarId: string;
  avatarUrl?: string;
  wins: number;
  gamesPlayed: number;
  xp: number;
  score: number;
  level: number;
  updatedAt: number;
}

export interface PlatformSettings {
  platformName: string;
  tagline: string;
  welcomeMessage: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  loginEnabled: boolean;
  publicRoomsEnabled: boolean;
  chatEnabled: boolean;
  notificationsEnabled: boolean;
  maxRoomCapacity: number;
  chatRateLimitMs: number;
}

export interface DrawStroke {
  id: string;
  color: string;
  size: number;
  points: Array<{ x: number; y: number }>;
  eraser?: boolean;
}

export interface ActiveGameSession {
  sessionId: string;
  roomId: string;
  gameId: GameId;
  mode: 'multiplayer' | 'practice';
  status: 'active' | 'finished';
  startedAt: number;
  finishedAt?: number;
  hostUid: string;
  players: Record<
    string,
    {
      uid: string;
      username: string;
      displayName: string;
      avatarId: string;
      score: number;
      wins?: number;
      ready?: boolean;
    }
  >;
  // Game-specific synced state payload
  state: Record<string, unknown>;
}

export interface ToastItem {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message?: string;
}
