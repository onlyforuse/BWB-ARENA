/**
 * BWB ARENA — Trusted Firebase Cloud Functions Reference Implementation
 *
 * Deploy to your `bwb-arena` Firebase project so authoritative coins, XP,
 * player levels, competitive leaderboard updates, daily challenge rewards,
 * and account deletion requests are written exclusively by Firebase Admin SDK
 * (never directly modifiable by player clients under database.rules.json).
 *
 * Setup:
 *   1. firebase init functions (TypeScript) targeting project `bwb-arena`
 *   2. Copy this file into `functions/src/index.ts`
 *   3. firebase deploy --only functions,database
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export const CLOUD_FUNCTIONS_SETUP_GUIDE = `
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.database();

function xpRequiredForLevel(level: number): number {
  return 250 * level + 75 * (level - 1) * (level - 1);
}

function computeLevel(totalXp: number): number {
  let xpLeft = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < 100 && xpLeft >= xpRequiredForLevel(level)) {
    xpLeft -= xpRequiredForLevel(level);
    level += 1;
  }
  return level;
}

export const onMatchSessionCompleted = functions.database
  .ref('/gameSessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.val();
    const after = change.after.val();
    if (!after || before?.status === 'finished' || after.status !== 'finished') {
      return null;
    }

    const winnerUid: string | null = after.winnerUid ?? null;
    const gameId: string = after.gameId;
    const players = after.players || {};
    const updates: Record<string, any> = {};

    for (const [uid, pState] of Object.entries<any>(players)) {
      const userSnap = await db.ref(\`/users/\${uid}\`).once('value');
      const user = userSnap.val();
      if (!user || user.status !== 'active') continue;

      const isWin = winnerUid === uid;
      const isDraw = winnerUid === 'draw';
      const xpGain = isWin ? 120 : isDraw ? 65 : 40;
      const coinGain = isWin ? 70 : isDraw ? 35 : 20;

      const nextXp = (user.xp || 0) + xpGain;
      const nextCoins = (user.coins || 0) + coinGain;
      const nextGames = (user.gamesPlayed || 0) + 1;
      const nextWins = (user.wins || 0) + (isWin ? 1 : 0);
      const nextLosses = (user.losses || 0) + (!isWin && !isDraw ? 1 : 0);
      const nextLevel = computeLevel(nextXp);

      updates[\`/users/\${uid}/xp\`] = nextXp;
      updates[\`/users/\${uid}/coins\`] = nextCoins;
      updates[\`/users/\${uid}/gamesPlayed\`] = nextGames;
      updates[\`/users/\${uid}/wins\`] = nextWins;
      updates[\`/users/\${uid}/losses\`] = nextLosses;
      updates[\`/users/\${uid}/level\`] = nextLevel;

      updates[\`/publicProfiles/\${uid}/xp\`] = nextXp;
      updates[\`/publicProfiles/\${uid}/wins\`] = nextWins;
      updates[\`/publicProfiles/\${uid}/gamesPlayed\`] = nextGames;
      updates[\`/publicProfiles/\${uid}/level\`] = nextLevel;

      const boardPayload = {
        uid,
        username: user.username,
        displayName: user.displayName,
        avatarId: user.avatarId || 'cyber-wolf',
        avatarUrl: user.avatarUrl || '',
        wins: nextWins,
        gamesPlayed: nextGames,
        xp: nextXp,
        score: (pState.score || 0) + nextWins * 100,
        level: nextLevel,
        updatedAt: Date.now(),
      };
      updates[\`/leaderboards/global/\${uid}\`] = boardPayload;
      updates[\`/leaderboards/\${gameId}/\${uid}\`] = boardPayload;
    }

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
    return null;
  });
`;
