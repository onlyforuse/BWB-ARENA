import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuditLogEntry,
  computeAdminAnalytics,
  filterAdminUsers,
  formatAuditLogsCsv,
  validateAnnouncementDraft,
  validateEconomyAdjustment,
  validatePlatformSettingsPatch,
  validateTournamentDraft,
} from './adminRules';
import type { AdminReport, ArenaGameDefinition, GameRoom, PlatformSettings, PlayerProfile } from '../types/arena';

function makeUser(overrides: Partial<PlayerProfile>): PlayerProfile {
  return {
    uid: 'u1',
    fullName: 'Aarav Sharma',
    displayName: 'Aarav',
    username: 'aarav_gg',
    email: 'aarav@bwbarena.gg',
    emailVerified: true,
    avatarId: 'cyber-wolf',
    bio: '',
    joinDate: 1700000000000,
    status: 'active',
    role: 'player',
    online: false,
    lastSeen: 1700000000000,
    level: 2,
    xp: 350,
    coins: 500,
    gamesPlayed: 10,
    wins: 6,
    losses: 4,
    draws: 0,
    currentStreak: 2,
    bestStreak: 4,
    gameStats: {
      'quiz-battle': { played: 6, wins: 4, losses: 2, draws: 0, bestScore: 840 },
      'tic-tac-toe': { played: 4, wins: 2, losses: 2, draws: 0, bestScore: 3 },
    },
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
    soundPrefs: { enabled: true, volume: 0.5 },
    theme: 'dark',
    ...overrides,
  };
}

const sampleGames: ArenaGameDefinition[] = [
  {
    id: 'quiz-battle',
    title: 'Quiz Battle',
    shortTitle: 'Quiz',
    category: 'Trivia',
    description: 'Trivia',
    thumbnail: '',
    minPlayers: 2,
    maxPlayers: 8,
    enabled: true,
    featured: true,
    trending: true,
    statusLabel: 'Live',
    avgDuration: '3 min',
    xpRewardWin: 130,
    coinRewardWin: 80,
    instructions: ['Answer quickly'],
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    shortTitle: 'TTT',
    category: 'Strategy',
    description: '3x3',
    thumbnail: '',
    minPlayers: 2,
    maxPlayers: 2,
    enabled: false,
    featured: false,
    trending: false,
    statusLabel: 'Maintenance',
    avgDuration: '2 min',
    xpRewardWin: 90,
    coinRewardWin: 55,
    instructions: ['3 in a row'],
  },
];

test('computeAdminAnalytics aggregates users, rooms, reports, economy, and game share accurately', () => {
  const users = [
    makeUser({ uid: 'u1', online: true, status: 'active', coins: 500, gamesPlayed: 10 }),
    makeUser({
      uid: 'u2',
      online: false,
      status: 'suspended',
      coins: 300,
      gamesPlayed: 5,
      gameStats: { 'quiz-battle': { played: 5, wins: 2, losses: 3, draws: 0, bestScore: 500 } },
    }),
    makeUser({ uid: 'u3', online: false, status: 'banned', coins: 100, gamesPlayed: 0, gameStats: {} }),
  ];

  const rooms: GameRoom[] = [
    {
      roomId: 'r1',
      code: 'BWB123',
      name: 'Quiz Finals',
      gameId: 'quiz-battle',
      hostUid: 'u1',
      hostUsername: 'aarav_gg',
      isPrivate: false,
      maxPlayers: 4,
      status: 'in_game',
      createdAt: 1,
      updatedAt: 1,
      expiresAt: 9999999999999,
      participants: {},
    },
    {
      roomId: 'r2',
      code: 'OLD999',
      name: 'Closed',
      gameId: 'tic-tac-toe',
      hostUid: 'u2',
      hostUsername: 'other',
      isPrivate: true,
      maxPlayers: 2,
      status: 'closed',
      createdAt: 1,
      updatedAt: 1,
      expiresAt: 9999999999999,
      participants: {},
    },
  ];

  const reports: AdminReport[] = [
    {
      id: 'rep1',
      type: 'chat_message',
      status: 'open',
      reportedUid: 'u2',
      reportedUsername: 'toxic_user',
      reporterUid: 'u1',
      reporterUsername: 'aarav_gg',
      reason: 'Spam',
      createdAt: 1000,
    },
    {
      id: 'rep2',
      type: 'chat_message',
      status: 'resolved',
      reportedUid: 'u3',
      reportedUsername: 'old_user',
      reporterUid: 'u1',
      reporterUsername: 'aarav_gg',
      reason: 'Abuse',
      createdAt: 900,
    },
  ];

  const summary = computeAdminAnalytics({ users, rooms, reports, games: sampleGames });

  assert.equal(summary.totalUsers, 3);
  assert.equal(summary.onlineUsers, 1);
  assert.equal(summary.activeUsers, 1);
  assert.equal(summary.suspendedUsers, 1);
  assert.equal(summary.bannedUsers, 1);
  assert.equal(summary.activeRooms, 1);
  assert.equal(summary.inGameRooms, 1);
  assert.equal(summary.totalMatchesPlayed, 15);
  assert.equal(summary.totalEconomyCoins, 900);
  assert.equal(summary.openReportsCount, 1);
  assert.equal(summary.enabledGamesCount, 1);
  assert.equal(summary.gameBreakdown[0].matchesPlayed, 11);
  assert.equal(summary.gameBreakdown[0].sharePercent, 73);
});

test('filterAdminUsers searches by username/email/uid and sorts deterministically', () => {
  const users = [
    makeUser({ uid: 'u1', username: 'zara_pro', email: 'zara@bwb.gg', xp: 200, joinDate: 100 }),
    makeUser({ uid: 'u2', username: 'alpha_king', email: 'alpha@bwb.gg', xp: 1200, status: 'suspended', joinDate: 300 }),
    makeUser({ uid: 'u3', username: 'nova_satyam', email: 'satyam@bwb.gg', xp: 800, role: 'admin', joinDate: 200 }),
  ];

  const byXp = filterAdminUsers(users, { query: '', status: 'all', role: 'all', sortBy: 'xp' });
  assert.deepEqual(
    byXp.map((u) => u.uid),
    ['u2', 'u3', 'u1'],
  );

  const onlySuspended = filterAdminUsers(users, { query: '', status: 'suspended', role: 'all', sortBy: 'newest' });
  assert.equal(onlySuspended.length, 1);
  assert.equal(onlySuspended[0].uid, 'u2');

  const queryEmail = filterAdminUsers(users, { query: 'satyam@bwb', status: 'all', role: 'admin', sortBy: 'username' });
  assert.equal(queryEmail.length, 1);
  assert.equal(queryEmail[0].username, 'nova_satyam');
});

test('validateEconomyAdjustment computes updated level and blocks negative balances or excessive amounts', () => {
  const ok = validateEconomyAdjustment({
    currentCoins: 200,
    currentXp: 240,
    coinsDelta: 300,
    xpDelta: 600,
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.nextCoins, 500);
  assert.equal(ok.nextXp, 840);
  assert.equal(ok.nextLevel, 3);

  const negCoins = validateEconomyAdjustment({
    currentCoins: 100,
    currentXp: 100,
    coinsDelta: -250,
    xpDelta: 0,
  });
  assert.equal(negCoins.valid, false);

  const huge = validateEconomyAdjustment({
    currentCoins: 100,
    currentXp: 100,
    coinsDelta: 5_000_000,
    xpDelta: 0,
  });
  assert.equal(huge.valid, false);
});

test('validateAnnouncementDraft and validateTournamentDraft reject empty or out-of-bounds fields', () => {
  assert.equal(validateAnnouncementDraft({ title: 'Hi', body: 'Too short' }).valid, false);
  assert.equal(
    validateAnnouncementDraft({ title: 'Season 2 Launch', body: 'New tournament brackets open tonight at 8 PM IST.' }).valid,
    true,
  );

  assert.equal(
    validateTournamentDraft({
      title: 'Cup',
      format: 'Bo3',
      prizeCoins: 1000,
      prizeXp: 500,
      maxSlots: 32,
      startsAt: Date.now() + 3600000,
    }).valid,
    false,
  );

  assert.equal(
    validateTournamentDraft({
      title: 'BWB Masters Cup',
      format: 'Best of 3',
      prizeCoins: 2500,
      prizeXp: 1200,
      maxSlots: 32,
      startsAt: Date.now() + 3600000,
    }).valid,
    true,
  );
});

test('validatePlatformSettingsPatch enforces safe room capacity and chat cooldown bounds', () => {
  const base: PlatformSettings = {
    platformName: 'BWB ARENA',
    tagline: 'Play Together. Compete Forever.',
    welcomeMessage: 'Welcome back!',
    maintenanceMode: false,
    registrationEnabled: true,
    loginEnabled: true,
    publicRoomsEnabled: true,
    chatEnabled: true,
    notificationsEnabled: true,
    maxRoomCapacity: 8,
    chatRateLimitMs: 1200,
  };

  assert.equal(validatePlatformSettingsPatch(base).valid, true);
  assert.equal(validatePlatformSettingsPatch({ ...base, maxRoomCapacity: 12 }).valid, false);
  assert.equal(validatePlatformSettingsPatch({ ...base, chatRateLimitMs: 50 }).valid, false);
});

test('formatAuditLogsCsv escapes quotes and commas cleanly per RFC 4180', () => {
  const log = buildAuditLogEntry({
    adminUid: 'admin_1',
    adminEmail: 'satyam@bwbarena.gg',
    category: 'moderation',
    action: 'Suspended User',
    target: '@toxic_player',
    details: 'Reason: "Spamming, abusive language"',
    timestamp: 1730000000000,
  });

  const csv = formatAuditLogsCsv([log]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('Timestamp,Admin Email,Category,Action,Target,Details'));
  assert.ok(lines[1].includes('"Reason: ""Spamming, abusive language"""'));
});
