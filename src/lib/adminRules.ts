import type {
  AccountStatus,
  AdminAuditCategory,
  AdminLogEntry,
  AdminReport,
  ArenaGameDefinition,
  GameId,
  GameRoom,
  PlatformSettings,
  PlayerProfile,
} from '../types/arena';
import { calculateLevelFromXp } from './gameRules';

export interface AdminAnalyticsSummary {
  totalUsers: number;
  onlineUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  activeRooms: number;
  inGameRooms: number;
  totalMatchesPlayed: number;
  totalEconomyCoins: number;
  openReportsCount: number;
  enabledGamesCount: number;
  gameBreakdown: Array<{
    gameId: GameId;
    title: string;
    enabled: boolean;
    matchesPlayed: number;
    activeRooms: number;
    sharePercent: number;
  }>;
}

export function computeAdminAnalytics(params: {
  users: PlayerProfile[];
  rooms: GameRoom[];
  reports: AdminReport[];
  games: ArenaGameDefinition[];
}): AdminAnalyticsSummary {
  const { users, rooms, reports, games } = params;

  let onlineUsers = 0;
  let activeUsers = 0;
  let suspendedUsers = 0;
  let bannedUsers = 0;
  let totalMatchesPlayed = 0;
  let totalEconomyCoins = 0;

  const gameMatchCounts: Record<string, number> = {};

  for (const user of users) {
    if (user.online) onlineUsers += 1;
    if (user.status === 'active') activeUsers += 1;
    else if (user.status === 'suspended') suspendedUsers += 1;
    else if (user.status === 'banned') bannedUsers += 1;

    totalMatchesPlayed += Math.max(0, user.gamesPlayed || 0);
    totalEconomyCoins += Math.max(0, user.coins || 0);

    if (user.gameStats) {
      for (const [gId, stats] of Object.entries(user.gameStats)) {
        if (!stats) continue;
        gameMatchCounts[gId] = (gameMatchCounts[gId] || 0) + Math.max(0, stats.played || 0);
      }
    }
  }

  const liveRooms = rooms.filter((r) => r.status !== 'closed');
  const inGameRooms = liveRooms.filter((r) => r.status === 'in_game').length;
  const openReportsCount = reports.filter((r) => r.status === 'open').length;
  const enabledGamesCount = games.filter((g) => g.enabled).length;

  const totalGameStatMatches = Object.values(gameMatchCounts).reduce((sum, v) => sum + v, 0);

  const gameBreakdown = games.map((g) => {
    const matchesPlayed = gameMatchCounts[g.id] || 0;
    const activeRoomsForGame = liveRooms.filter((r) => r.gameId === g.id).length;
    const sharePercent =
      totalGameStatMatches > 0 ? Math.round((matchesPlayed / totalGameStatMatches) * 100) : 0;
    return {
      gameId: g.id,
      title: g.title,
      enabled: g.enabled,
      matchesPlayed,
      activeRooms: activeRoomsForGame,
      sharePercent,
    };
  });

  return {
    totalUsers: users.length,
    onlineUsers,
    activeUsers,
    suspendedUsers,
    bannedUsers,
    activeRooms: liveRooms.length,
    inGameRooms,
    totalMatchesPlayed,
    totalEconomyCoins,
    openReportsCount,
    enabledGamesCount,
    gameBreakdown,
  };
}

export type AdminUserSortKey = 'newest' | 'xp' | 'coins' | 'wins' | 'username';

export function filterAdminUsers(
  users: PlayerProfile[],
  filters: {
    query: string;
    status: 'all' | AccountStatus;
    role: 'all' | 'player' | 'admin';
    sortBy: AdminUserSortKey;
  },
): PlayerProfile[] {
  const q = filters.query.trim().toLowerCase();

  const filtered = users.filter((u) => {
    if (filters.status !== 'all' && u.status !== filters.status) return false;
    if (filters.role !== 'all' && u.role !== filters.role) return false;
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    );
  });

  return [...filtered].sort((a, b) => {
    switch (filters.sortBy) {
      case 'xp':
        return (b.xp || 0) - (a.xp || 0);
      case 'coins':
        return (b.coins || 0) - (a.coins || 0);
      case 'wins':
        return (b.wins || 0) - (a.wins || 0);
      case 'username':
        return a.username.localeCompare(b.username);
      case 'newest':
      default:
        return (b.joinDate || 0) - (a.joinDate || 0);
    }
  });
}

export function validateEconomyAdjustment(params: {
  currentCoins: number;
  currentXp: number;
  coinsDelta: number;
  xpDelta: number;
}): {
  valid: boolean;
  error?: string;
  nextCoins: number;
  nextXp: number;
  nextLevel: number;
} {
  if (!Number.isFinite(params.coinsDelta) || !Number.isFinite(params.xpDelta)) {
    return {
      valid: false,
      error: 'Enter valid numeric values for coins and XP.',
      nextCoins: params.currentCoins,
      nextXp: params.currentXp,
      nextLevel: calculateLevelFromXp(params.currentXp).level,
    };
  }

  if (Math.abs(params.coinsDelta) > 1_000_000 || Math.abs(params.xpDelta) > 1_000_000) {
    return {
      valid: false,
      error: 'Single adjustment cannot exceed 1,000,000 coins or XP.',
      nextCoins: params.currentCoins,
      nextXp: params.currentXp,
      nextLevel: calculateLevelFromXp(params.currentXp).level,
    };
  }

  const nextCoins = Math.round(params.currentCoins + params.coinsDelta);
  const nextXp = Math.round(params.currentXp + params.xpDelta);

  if (nextCoins < 0) {
    return {
      valid: false,
      error: 'Arena Coins balance cannot drop below 0.',
      nextCoins: params.currentCoins,
      nextXp: params.currentXp,
      nextLevel: calculateLevelFromXp(params.currentXp).level,
    };
  }

  if (nextXp < 0) {
    return {
      valid: false,
      error: 'Player XP cannot drop below 0.',
      nextCoins: params.currentCoins,
      nextXp: params.currentXp,
      nextLevel: calculateLevelFromXp(params.currentXp).level,
    };
  }

  return {
    valid: true,
    nextCoins,
    nextXp,
    nextLevel: calculateLevelFromXp(nextXp).level,
  };
}

export function validateAnnouncementDraft(draft: {
  title: string;
  body: string;
}): { valid: boolean; error?: string } {
  const title = draft.title.trim();
  const body = draft.body.trim();
  if (title.length < 4) {
    return { valid: false, error: 'Announcement title must be at least 4 characters.' };
  }
  if (title.length > 110) {
    return { valid: false, error: 'Announcement title cannot exceed 110 characters.' };
  }
  if (body.length < 10) {
    return { valid: false, error: 'Announcement message must be at least 10 characters.' };
  }
  if (body.length > 600) {
    return { valid: false, error: 'Announcement message cannot exceed 600 characters.' };
  }
  return { valid: true };
}

export function validateTournamentDraft(draft: {
  title: string;
  format: string;
  prizeCoins: number;
  prizeXp: number;
  maxSlots: number;
  startsAt: number;
}): { valid: boolean; error?: string } {
  if (draft.title.trim().length < 4) {
    return { valid: false, error: 'Tournament title must be at least 4 characters.' };
  }
  if (draft.format.trim().length < 3) {
    return { valid: false, error: 'Specify a valid tournament format (e.g. Best of 3).' };
  }
  if (!Number.isFinite(draft.prizeCoins) || draft.prizeCoins < 0 || draft.prizeCoins > 500_000) {
    return { valid: false, error: 'Prize Coins must be between 0 and 500,000.' };
  }
  if (!Number.isFinite(draft.prizeXp) || draft.prizeXp < 0 || draft.prizeXp > 100_000) {
    return { valid: false, error: 'Prize XP must be between 0 and 100,000.' };
  }
  if (!Number.isInteger(draft.maxSlots) || draft.maxSlots < 4 || draft.maxSlots > 512) {
    return { valid: false, error: 'Max slots must be an integer between 4 and 512.' };
  }
  if (!Number.isFinite(draft.startsAt) || draft.startsAt <= 0) {
    return { valid: false, error: 'Choose a valid start date and time.' };
  }
  return { valid: true };
}

export function validatePlatformSettingsPatch(
  settings: PlatformSettings,
): { valid: boolean; error?: string; normalized: PlatformSettings } {
  const name = settings.platformName.trim();
  const tagline = settings.tagline.trim();
  const welcomeMessage = settings.welcomeMessage.trim();

  if (name.length < 2 || name.length > 48) {
    return { valid: false, error: 'Platform name must be 2 to 48 characters.', normalized: settings };
  }
  if (tagline.length < 4 || tagline.length > 90) {
    return { valid: false, error: 'Tagline must be 4 to 90 characters.', normalized: settings };
  }
  if (!Number.isInteger(settings.maxRoomCapacity) || settings.maxRoomCapacity < 2 || settings.maxRoomCapacity > 8) {
    return { valid: false, error: 'Max room capacity must be between 2 and 8 players.', normalized: settings };
  }
  if (!Number.isFinite(settings.chatRateLimitMs) || settings.chatRateLimitMs < 250 || settings.chatRateLimitMs > 15000) {
    return { valid: false, error: 'Chat cooldown must be between 250ms and 15,000ms.', normalized: settings };
  }

  return {
    valid: true,
    normalized: {
      ...settings,
      platformName: name,
      tagline,
      welcomeMessage: welcomeMessage || 'Welcome to BWB ARENA.',
    },
  };
}

export function buildAuditLogEntry(params: {
  adminUid: string;
  adminEmail: string;
  category: AdminAuditCategory;
  action: string;
  target: string;
  details: string;
  timestamp?: number;
}): AdminLogEntry {
  const ts = params.timestamp ?? Date.now();
  return {
    id: `log_${ts}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: ts,
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    category: params.category,
    action: params.action,
    target: params.target,
    details: params.details,
  };
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatAuditLogsCsv(logs: AdminLogEntry[]): string {
  const header = ['Timestamp', 'Admin Email', 'Category', 'Action', 'Target', 'Details'];
  const rows = logs.map((entry) => [
    new Date(entry.timestamp).toISOString(),
    entry.adminEmail,
    entry.category,
    entry.action,
    entry.target,
    entry.details,
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}
