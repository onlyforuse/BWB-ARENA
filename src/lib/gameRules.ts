import type { GameId } from '../types/arena';

// ---------------------------------------------------------------------------
// 1. Account Validation, Chat Sanitization & Rate Limiting
// ---------------------------------------------------------------------------

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const value = normalizeUsername(raw);
  if (!value) return 'Username is required.';
  if (value.length < 3 || value.length > 20) {
    return 'Username must be between 3 and 20 characters.';
  }
  if (!/^[a-z0-9_]+$/.test(value)) {
    return 'Username may only include lowercase letters, numbers, and underscores.';
  }
  const reserved = new Set(['admin', 'superadmin', 'bwb', 'bwbarena', 'support', 'moderator', 'system']);
  if (reserved.has(value)) {
    return 'This username is reserved.';
  }
  return null;
}

export interface RegistrationPayload {
  fullName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function validateRegistrationForm(data: RegistrationPayload): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.fullName.trim() || data.fullName.trim().length < 2) {
    errors.fullName = 'Enter your full name (at least 2 characters).';
  }
  const uErr = validateUsername(data.username);
  if (uErr) errors.username = uErr;

  const email = data.email.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!data.password || data.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }
  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
}

export function sanitizeChatMessage(raw: string): { valid: boolean; text: string; error?: string } {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return { valid: false, text: '', error: 'Message cannot be empty.' };
  }
  if (cleaned.length > 240) {
    return { valid: false, text: cleaned.slice(0, 240), error: 'Messages are limited to 240 characters.' };
  }
  return { valid: true, text: cleaned };
}

export function isRateLimited(lastSentAt: number, now: number, limitMs: number): boolean {
  if (lastSentAt <= 0) return false;
  return now - lastSentAt < limitMs;
}

// ---------------------------------------------------------------------------
// 2. Room Code & Capacity Logic
// ---------------------------------------------------------------------------

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(seedRandom?: () => number): string {
  const rng = seedRandom ?? Math.random;
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += ROOM_ALPHABET[Math.floor(rng() * ROOM_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function canJoinRoom(params: {
  status: string;
  currentCount: number;
  maxPlayers: number;
  alreadyInRoom: boolean;
}): { allowed: boolean; reason?: string } {
  if (params.alreadyInRoom) {
    return { allowed: true };
  }
  if (params.status === 'closed' || params.status === 'finished') {
    return { allowed: false, reason: 'This room is no longer active.' };
  }
  if (params.status === 'in_game') {
    return { allowed: false, reason: 'A match is already underway in this room.' };
  }
  if (params.currentCount >= params.maxPlayers) {
    return { allowed: false, reason: 'Room is at full player capacity.' };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 3. Level, XP, Win Rate & Match Reward Calculation
// ---------------------------------------------------------------------------

export function xpRequiredForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  // Progressive esports curve: Level 1->2 = 250 XP, scaling smoothly
  return 250 * safeLevel + 75 * (safeLevel - 1) * (safeLevel - 1);
}

export function calculateLevelFromXp(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
} {
  let xpLeft = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < 100) {
    const req = xpRequiredForLevel(level);
    if (xpLeft < req) {
      return {
        level,
        currentLevelXp: xpLeft,
        nextLevelXp: req,
        progressPercent: Math.min(100, Math.round((xpLeft / req) * 100)),
      };
    }
    xpLeft -= req;
    level += 1;
  }
  return { level: 100, currentLevelXp: 0, nextLevelXp: 1, progressPercent: 100 };
}

export function calculateWinRate(wins: number, gamesPlayed: number): number {
  if (gamesPlayed <= 0) return 0;
  return Math.round((wins / gamesPlayed) * 1000) / 10;
}

export function calculateMatchRewards(params: {
  gameId: GameId;
  outcome: 'win' | 'loss' | 'draw';
  mode: 'multiplayer' | 'practice';
  score: number;
}): { xp: number; coins: number } {
  const baseWinXp: Record<GameId, number> = {
    'can-you-guess': 140,
    'quiz-battle': 130,
    'tic-tac-toe': 90,
    'rock-paper-scissors': 85,
    'word-battle': 125,
  };
  const baseWinCoins: Record<GameId, number> = {
    'can-you-guess': 85,
    'quiz-battle': 75,
    'tic-tac-toe': 50,
    'rock-paper-scissors': 45,
    'word-battle': 70,
  };

  const modeFactor = params.mode === 'multiplayer' ? 1 : 0.6;
  const outcomeFactor = params.outcome === 'win' ? 1 : params.outcome === 'draw' ? 0.55 : 0.35;
  const scoreBonusXp = Math.min(60, Math.max(0, Math.floor(params.score / 25)));

  const xp = Math.max(15, Math.round(baseWinXp[params.gameId] * outcomeFactor * modeFactor + scoreBonusXp));
  const coins = Math.max(10, Math.round(baseWinCoins[params.gameId] * outcomeFactor * modeFactor));
  return { xp, coins };
}

// ---------------------------------------------------------------------------
// 4. Tic Tac Toe Rules & Minimax Bot
// ---------------------------------------------------------------------------

export type TttMark = 'X' | 'O' | null;

const TTT_LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function evaluateTicTacToe(board: TttMark[]): {
  winner: 'X' | 'O' | 'draw' | null;
  line: readonly [number, number, number] | null;
} {
  for (const line of TTT_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: 'draw', line: null };
  }
  return { winner: null, line: null };
}

function minimaxTtt(board: TttMark[], isMaximizing: boolean, botMark: 'X' | 'O', humanMark: 'X' | 'O', depth: number): number {
  const { winner } = evaluateTicTacToe(board);
  if (winner === botMark) return 10 - depth;
  if (winner === humanMark) return depth - 10;
  if (winner === 'draw') return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i += 1) {
      if (board[i] === null) {
        board[i] = botMark;
        best = Math.max(best, minimaxTtt(board, false, botMark, humanMark, depth + 1));
        board[i] = null;
      }
    }
    return best;
  }

  let best = Infinity;
  for (let i = 0; i < 9; i += 1) {
    if (board[i] === null) {
      board[i] = humanMark;
      best = Math.min(best, minimaxTtt(board, true, botMark, humanMark, depth + 1));
      board[i] = null;
    }
  }
  return best;
}

export function getBestTicTacToeMove(
  board: TttMark[],
  botMark: 'X' | 'O',
  difficulty: 'casual' | 'pro' = 'pro',
  rng: () => number = Math.random,
): number {
  const available: number[] = [];
  for (let i = 0; i < 9; i += 1) {
    if (board[i] === null) available.push(i);
  }
  if (available.length === 0) return -1;

  // Casual mode occasionally picks a random open tile to keep matches fun & winnable
  if (difficulty === 'casual' && rng() < 0.45) {
    return available[Math.floor(rng() * available.length)];
  }

  const humanMark = botMark === 'X' ? 'O' : 'X';
  const copy = [...board];
  let bestScore = -Infinity;
  let bestMove = available[0];

  for (const idx of available) {
    copy[idx] = botMark;
    const score = minimaxTtt(copy, false, botMark, humanMark, 0);
    copy[idx] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = idx;
    }
  }
  return bestMove;
}

// ---------------------------------------------------------------------------
// 5. Rock Paper Scissors Rules
// ---------------------------------------------------------------------------

export type RpsChoice = 'rock' | 'paper' | 'scissors';

export function resolveRpsRound(
  p1: RpsChoice,
  p2: RpsChoice,
): 'p1' | 'p2' | 'draw' {
  if (p1 === p2) return 'draw';
  if (
    (p1 === 'rock' && p2 === 'scissors') ||
    (p1 === 'paper' && p2 === 'rock') ||
    (p1 === 'scissors' && p2 === 'paper')
  ) {
    return 'p1';
  }
  return 'p2';
}

export function pickAdaptiveRpsBotMove(playerHistory: RpsChoice[], rng: () => number = Math.random): RpsChoice {
  const choices: RpsChoice[] = ['rock', 'paper', 'scissors'];
  if (playerHistory.length >= 2 && rng() < 0.45) {
    const last = playerHistory[playerHistory.length - 1];
    if (last === 'rock') return 'paper';
    if (last === 'paper') return 'scissors';
    return 'rock';
  }
  return choices[Math.floor(rng() * choices.length)];
}

// ---------------------------------------------------------------------------
// 6. Word Battle Rules & Dictionary
// ---------------------------------------------------------------------------

export type LetterTileState = 'correct' | 'present' | 'absent';

export const WORD_BATTLE_WORDS = [
  'ARENA', 'BLADE', 'CLASH', 'CROWN', 'CYBER', 'DRIFT', 'FLAME', 'FLASH',
  'FORCE', 'GHOST', 'GLORY', 'HYPER', 'LASER', 'LEVEL', 'MAGIC', 'NEXUS',
  'NITRO', 'ORBIT', 'PIXEL', 'POWER', 'PRISM', 'PULSE', 'QUEST', 'RADAR',
  'RAVEN', 'REIGN', 'ROGUE', 'SCORE', 'SHARD', 'SHIELD'.slice(0, 5), 'SKILL', 'SONIC',
  'SPARK', 'SPEED', 'SPIKE', 'SQUAD', 'STAGE', 'STORM', 'STRIK'.slice(0, 5), 'SURGE',
  'TITAN', 'TOKEN', 'TOWER', 'TRACK', 'TROOP', 'ULTRA', 'VALOR', 'VAULT',
  'VIPER', 'VORTX'.slice(0, 5), 'WINGS', 'WRATH',
].filter((w) => w.length === 5 && /^[A-Z]{5}$/.test(w));

export const CLEAN_WORD_BANK = [
  'ARENA', 'BLADE', 'CLASH', 'CROWN', 'CYBER', 'DRIFT', 'FLAME', 'FLASH',
  'FORCE', 'GHOST', 'GLORY', 'HYPER', 'LASER', 'LEVEL', 'MAGIC', 'NEXUS',
  'NITRO', 'ORBIT', 'PIXEL', 'POWER', 'PRISM', 'PULSE', 'QUEST', 'RADAR',
  'RAVEN', 'REIGN', 'ROGUE', 'SCORE', 'SHARD', 'SKILL', 'SONIC', 'SPARK',
  'SPEED', 'SPIKE', 'SQUAD', 'STAGE', 'STORM', 'SURGE', 'TITAN', 'TOKEN',
  'TOWER', 'TRACK', 'TROOP', 'ULTRA', 'VALOR', 'VAULT', 'VIPER', 'WINGS',
  'WRATH', 'BRAVE', 'CRAFT', 'DRIVE', 'ELITE', 'FOCUS', 'GUARD', 'HONOR',
  'INDEX', 'JOKER', 'KNIGHT'.slice(0, 5), 'LIGHT', 'MATCH', 'NOBLE', 'OMEGA',
  'PILOT', 'QUICK', 'RIVAL', 'SCOUT', 'TEMPO', 'UNITY', 'VIGOR', 'WATCH',
].filter((w) => w.length === 5);

export function evaluateWordGuess(guessRaw: string, targetRaw: string): LetterTileState[] {
  const guess = guessRaw.toUpperCase();
  const target = targetRaw.toUpperCase();
  const result: LetterTileState[] = Array(target.length).fill('absent');
  const remaining: Record<string, number> = {};

  for (let i = 0; i < target.length; i += 1) {
    if (guess[i] === target[i]) {
      result[i] = 'correct';
    } else {
      remaining[target[i]] = (remaining[target[i]] ?? 0) + 1;
    }
  }

  for (let i = 0; i < target.length; i += 1) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if (remaining[ch] && remaining[ch] > 0) {
      result[i] = 'present';
      remaining[ch] -= 1;
    }
  }

  return result;
}

export function scoreWordBattleWin(attemptsUsed: number, secondsRemaining: number): number {
  const attemptBonus = Math.max(1, 7 - attemptsUsed) * 140;
  const speedBonus = Math.max(0, Math.round(secondsRemaining * 3));
  return attemptBonus + speedBonus;
}

// ---------------------------------------------------------------------------
// 7. Quiz Battle Rules & Question Bank
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  id: string;
  category: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export const QUIZ_QUESTION_BANK: QuizQuestion[] = [
  {
    id: 'q1',
    category: 'Esports',
    prompt: 'In competitive MOBAs, what does "GG" traditionally signify at the end of a match?',
    options: ['Good Game', 'Game Glitch', 'Gold Gain', 'Guard Gate'],
    correctIndex: 0,
  },
  {
    id: 'q2',
    category: 'Technology',
    prompt: 'Which HTTP status code indicates that a request succeeded and created a new resource?',
    options: ['200 OK', '201 Created', '204 No Content', '304 Not Modified'],
    correctIndex: 1,
  },
  {
    id: 'q3',
    category: 'Science',
    prompt: 'What is the only planet in our solar system known to rotate clockwise when viewed from above its north pole?',
    options: ['Mercury', 'Mars', 'Venus', 'Neptune'],
    correctIndex: 2,
  },
  {
    id: 'q4',
    category: 'Gaming History',
    prompt: 'Which iconic puzzle video game was originally created by Alexey Pajitnov in 1984?',
    options: ['Pac-Man', 'Tetris', 'Breakout', 'Pong'],
    correctIndex: 1,
  },
  {
    id: 'q5',
    category: 'Strategy',
    prompt: 'In standard chess, how many total squares make up the chessboard?',
    options: ['48', '56', '64', '72'],
    correctIndex: 2,
  },
  {
    id: 'q6',
    category: 'Computing',
    prompt: 'How many bits make up a single byte in modern computer architecture?',
    options: ['4 bits', '8 bits', '16 bits', '32 bits'],
    correctIndex: 1,
  },
  {
    id: 'q7',
    category: 'Geography',
    prompt: 'Which city hosted the first modern Olympic Games in 1896?',
    options: ['Paris', 'London', 'Rome', 'Athens'],
    correctIndex: 3,
  },
  {
    id: 'q8',
    category: 'Esports',
    prompt: 'What does "FPS" measure when evaluating real-time gaming performance?',
    options: ['Frames Per Second', 'Fast Packet Sync', 'Field Play Score', 'Full Pixel Scale'],
    correctIndex: 0,
  },
  {
    id: 'q9',
    category: 'Science',
    prompt: 'Which chemical element has the atomic symbol "Au"?',
    options: ['Silver', 'Argon', 'Gold', 'Aluminum'],
    correctIndex: 2,
  },
  {
    id: 'q10',
    category: 'Gaming',
    prompt: 'What is the maximum possible score in a single game of ten-pin bowling?',
    options: ['250', '280', '300', '360'],
    correctIndex: 2,
  },
  {
    id: 'q11',
    category: 'Space',
    prompt: 'Approximately how long does sunlight take to travel from the Sun to Earth?',
    options: ['2 minutes', '8 minutes', '24 minutes', '60 minutes'],
    correctIndex: 1,
  },
  {
    id: 'q12',
    category: 'Technology',
    prompt: 'Which data structure operates on a Last-In, First-Out (LIFO) principle?',
    options: ['Queue', 'Linked List', 'Stack', 'Hash Map'],
    correctIndex: 2,
  },
];

export function scoreQuizAnswer(params: {
  correct: boolean;
  secondsRemaining: number;
  maxSeconds: number;
  streakBefore: number;
}): { points: number; nextStreak: number } {
  if (!params.correct) {
    return { points: 0, nextStreak: 0 };
  }
  const nextStreak = params.streakBefore + 1;
  const speedRatio = Math.max(0, Math.min(1, params.secondsRemaining / Math.max(1, params.maxSeconds)));
  const base = 100;
  const speedBonus = Math.round(speedRatio * 80);
  const streakBonus = Math.min(4, nextStreak - 1) * 25;
  return { points: base + speedBonus + streakBonus, nextStreak };
}

// ---------------------------------------------------------------------------
// 8. Can You Guess Rules & Practice Sketch Blueprints
// ---------------------------------------------------------------------------

export interface SketchBlueprint {
  word: string;
  hint: string;
  category: string;
  strokes: Array<{ color: string; size: number; points: Array<{ x: number; y: number }> }>;
}

export const DRAWING_PROMPTS: SketchBlueprint[] = [
  {
    word: 'ROCKET',
    hint: 'Launches into orbit',
    category: 'Space',
    strokes: [
      { color: '#22D3EE', size: 5, points: [{ x: 0.5, y: 0.16 }, { x: 0.4, y: 0.36 }, { x: 0.4, y: 0.68 }, { x: 0.6, y: 0.68 }, { x: 0.6, y: 0.36 }, { x: 0.5, y: 0.16 }] },
      { color: '#8B5CF6', size: 5, points: [{ x: 0.4, y: 0.54 }, { x: 0.28, y: 0.72 }, { x: 0.4, y: 0.68 }] },
      { color: '#8B5CF6', size: 5, points: [{ x: 0.6, y: 0.54 }, { x: 0.72, y: 0.72 }, { x: 0.6, y: 0.68 }] },
      { color: '#F8FAFC', size: 4, points: [{ x: 0.5, y: 0.41 }, { x: 0.54, y: 0.44 }, { x: 0.5, y: 0.48 }, { x: 0.46, y: 0.44 }, { x: 0.5, y: 0.41 }] },
      { color: '#F59E0B', size: 6, points: [{ x: 0.45, y: 0.72 }, { x: 0.5, y: 0.88 }, { x: 0.55, y: 0.72 }] },
    ],
  },
  {
    word: 'CROWN',
    hint: 'Worn by a champion',
    category: 'Esports',
    strokes: [
      { color: '#F59E0B', size: 6, points: [{ x: 0.22, y: 0.7 }, { x: 0.22, y: 0.34 }, { x: 0.38, y: 0.54 }, { x: 0.5, y: 0.26 }, { x: 0.62, y: 0.54 }, { x: 0.78, y: 0.34 }, { x: 0.78, y: 0.7 }, { x: 0.22, y: 0.7 }] },
      { color: '#22D3EE', size: 5, points: [{ x: 0.26, y: 0.62 }, { x: 0.74, y: 0.62 }] },
    ],
  },
  {
    word: 'TROPHY',
    hint: 'Tournament grand prize',
    category: 'Esports',
    strokes: [
      { color: '#F59E0B', size: 6, points: [{ x: 0.32, y: 0.24 }, { x: 0.68, y: 0.24 }, { x: 0.62, y: 0.52 }, { x: 0.5, y: 0.6 }, { x: 0.38, y: 0.52 }, { x: 0.32, y: 0.24 }] },
      { color: '#F59E0B', size: 5, points: [{ x: 0.32, y: 0.3 }, { x: 0.22, y: 0.35 }, { x: 0.25, y: 0.48 }, { x: 0.37, y: 0.47 }] },
      { color: '#F59E0B', size: 5, points: [{ x: 0.68, y: 0.3 }, { x: 0.78, y: 0.35 }, { x: 0.75, y: 0.48 }, { x: 0.63, y: 0.47 }] },
      { color: '#8B5CF6', size: 6, points: [{ x: 0.5, y: 0.6 }, { x: 0.5, y: 0.76 }, { x: 0.34, y: 0.78 }, { x: 0.66, y: 0.78 }] },
    ],
  },
  {
    word: 'LIGHTNING',
    hint: 'Electric bolt from a storm',
    category: 'Nature',
    strokes: [
      { color: '#22D3EE', size: 7, points: [{ x: 0.56, y: 0.16 }, { x: 0.36, y: 0.5 }, { x: 0.52, y: 0.5 }, { x: 0.42, y: 0.84 }, { x: 0.66, y: 0.44 }, { x: 0.5, y: 0.44 }, { x: 0.56, y: 0.16 }] },
    ],
  },
  {
    word: 'SHIELD',
    hint: 'Protects a warrior in battle',
    category: 'Combat',
    strokes: [
      { color: '#3B82F6', size: 6, points: [{ x: 0.28, y: 0.22 }, { x: 0.72, y: 0.22 }, { x: 0.7, y: 0.56 }, { x: 0.5, y: 0.82 }, { x: 0.3, y: 0.56 }, { x: 0.28, y: 0.22 }] },
      { color: '#22D3EE', size: 5, points: [{ x: 0.5, y: 0.28 }, { x: 0.5, y: 0.74 }] },
      { color: '#8B5CF6', size: 5, points: [{ x: 0.34, y: 0.46 }, { x: 0.66, y: 0.46 }] },
    ],
  },
  {
    word: 'SWORD',
    hint: 'Classic forged blade',
    category: 'Combat',
    strokes: [
      { color: '#22D3EE', size: 6, points: [{ x: 0.5, y: 0.14 }, { x: 0.54, y: 0.24 }, { x: 0.54, y: 0.64 }, { x: 0.46, y: 0.64 }, { x: 0.46, y: 0.24 }, { x: 0.5, y: 0.14 }] },
      { color: '#8B5CF6', size: 7, points: [{ x: 0.34, y: 0.64 }, { x: 0.66, y: 0.64 }] },
      { color: '#F59E0B', size: 6, points: [{ x: 0.5, y: 0.64 }, { x: 0.5, y: 0.84 }] },
    ],
  },
];

export function checkDrawingGuess(guessRaw: string, secretWord: string): 'exact' | 'close' | 'miss' {
  const g = guessRaw.trim().toUpperCase().replace(/[^A-Z]/g, '');
  const s = secretWord.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (!g || !s) return 'miss';
  if (g === s) return 'exact';

  // Detect 1-character typo as "close"
  if (Math.abs(g.length - s.length) <= 1) {
    let mismatches = 0;
    const minLen = Math.min(g.length, s.length);
    for (let i = 0; i < minLen; i += 1) {
      if (g[i] !== s[i]) mismatches += 1;
    }
    mismatches += Math.abs(g.length - s.length);
    if (mismatches <= 1 && s.length >= 4) return 'close';
  }
  return 'miss';
}

export function scoreDrawingGuess(secondsRemaining: number, maxSeconds: number): number {
  const ratio = Math.max(0, Math.min(1, secondsRemaining / Math.max(1, maxSeconds)));
  return Math.round(120 + ratio * 180);
}
