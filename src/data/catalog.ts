import type {
  AchievementDefinition,
  ArenaGameDefinition,
  DailyChallenge,
  LeaderboardEntry,
  PlatformAnnouncement,
  PlatformSettings,
  TournamentItem,
} from '../types/arena';

import heroArenaImg from '../assets/images/hero_arena_stage_1795010803781.jpg';
import gameCanYouGuessImg from '../assets/images/game_can_you_guess_1795010803871.jpg';
import gameQuizBattleImg from '../assets/images/game_quiz_battle_1795010803593.jpg';
import gameTicTacToeImg from '../assets/images/game_tic_tac_toe_1795010803784.jpg';
import gameRpsImg from '../assets/images/game_rock_paper_scissors_1795010804348.jpg';
import gameWordBattleImg from '../assets/images/game_word_battle_1795010804387.jpg';

export const HERO_ARENA_IMAGE = heroArenaImg;

export const AVATAR_PRESETS = [
  { id: 'cyber-wolf', label: 'Vanguard', bg: 'from-violet-600 to-indigo-700', glyph: 'VG' },
  { id: 'neon-falcon', label: 'Striker', bg: 'from-blue-600 to-cyan-500', glyph: 'ST' },
  { id: 'apex-crown', label: 'Apex', bg: 'from-fuchsia-600 to-violet-600', glyph: 'AP' },
  { id: 'cobalt-blade', label: 'Phantom', bg: 'from-sky-500 to-blue-700', glyph: 'PH' },
  { id: 'emerald-pulse', label: 'Sentinel', bg: 'from-emerald-500 to-teal-700', glyph: 'SN' },
  { id: 'solar-flare', label: 'Nova', bg: 'from-amber-500 to-rose-600', glyph: 'NV' },
  { id: 'prism-core', label: 'Spectre', bg: 'from-indigo-500 to-cyan-500', glyph: 'SP' },
  { id: 'obsidian-ace', label: 'Titan', bg: 'from-slate-700 to-violet-700', glyph: 'TT' },
] as const;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: 'BWB ARENA',
  tagline: 'PLAY TOGETHER. COMPETE FOREVER.',
  welcomeMessage: 'Step into live competitive rooms, challenge friends, and climb verified seasonal rankings.',
  maintenanceMode: false,
  registrationEnabled: true,
  loginEnabled: true,
  publicRoomsEnabled: true,
  chatEnabled: true,
  notificationsEnabled: true,
  maxRoomCapacity: 8,
  chatRateLimitMs: 1200,
};

export const INITIAL_GAMES_CATALOG: ArenaGameDefinition[] = [
  {
    id: 'can-you-guess',
    title: 'Can You Guess',
    shortTitle: 'Can You Guess',
    category: 'Creative',
    description:
      'Real-time multiplayer sketching showdown. Draw secret prompts on the synced obsidian canvas while rivals race the clock to guess first.',
    thumbnail: gameCanYouGuessImg,
    minPlayers: 2,
    maxPlayers: 8,
    enabled: true,
    featured: true,
    trending: true,
    statusLabel: 'Live',
    avgDuration: '4 min',
    xpRewardWin: 140,
    coinRewardWin: 85,
    instructions: [
      'Each round assigns one active artist who picks a secret word from 3 prompt cards.',
      'Sketch live using the color palette, brush sizes, and eraser — strokes sync instantly across the room.',
      'Other players type guesses in the answer bar; faster correct guesses earn higher speed bonus points.',
      'After all rounds conclude, the highest total score wins verified XP and arena coins.',
    ],
  },
  {
    id: 'quiz-battle',
    title: 'Quiz Battle',
    shortTitle: 'Quiz Battle',
    category: 'Trivia',
    description:
      'High-speed competitive trivia across esports, tech, science, and world knowledge. Lock answers fast to build streak multipliers.',
    thumbnail: gameQuizBattleImg,
    minPlayers: 2,
    maxPlayers: 8,
    enabled: true,
    featured: true,
    trending: true,
    statusLabel: 'Featured',
    avgDuration: '3 min',
    xpRewardWin: 130,
    coinRewardWin: 75,
    instructions: [
      'Matches span 7 timed rapid-fire questions with 15 seconds per prompt.',
      'Select your answer via tap, click, or keys 1–4 before the timer drains.',
      'Consecutive correct answers multiply your points through an active streak bonus.',
      'Score updates live after every round so every competitor tracks the race to first place.',
    ],
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    shortTitle: 'Tic Tac Toe',
    category: 'Strategy',
    description:
      'Classic 3x3 tactical duel elevated to a best-of-3 arena series with turn timers, instant rematches, and Minimax practice bots.',
    thumbnail: gameTicTacToeImg,
    minPlayers: 2,
    maxPlayers: 2,
    enabled: true,
    featured: true,
    trending: false,
    statusLabel: 'Live',
    avgDuration: '2 min',
    xpRewardWin: 90,
    coinRewardWin: 50,
    instructions: [
      'Two competitors face off as Cobalt X and Violet O in a best-of-3 match series.',
      'First player to claim three marks horizontally, vertically, or diagonally takes the round.',
      'In multiplayer rooms, turns synchronize atomically through Firebase Realtime Database.',
      'Solo practice offers both Casual and Unbeatable Pro Minimax difficulty tiers.',
    ],
  },
  {
    id: 'rock-paper-scissors',
    title: 'Rock Paper Scissors',
    shortTitle: 'RPS Duel',
    category: 'Arcade',
    description:
      'Simultaneous hidden-lock best-of-5 mind game. Read patterns, lock your emblem before the buzzer, and break enemy streaks.',
    thumbnail: gameRpsImg,
    minPlayers: 2,
    maxPlayers: 2,
    enabled: true,
    featured: false,
    trending: true,
    statusLabel: 'Live',
    avgDuration: '2 min',
    xpRewardWin: 85,
    coinRewardWin: 45,
    instructions: [
      'Both players simultaneously choose Rock, Paper, or Scissors while choices stay hidden.',
      'Once both moves lock in, emblems reveal simultaneously with full round-by-round history.',
      'Rock crushes Scissors, Scissors cuts Paper, Paper covers Rock — first to 3 round wins claims the series.',
      'Track opponent tendencies in the live round log to out-predict their next lock.',
    ],
  },
  {
    id: 'word-battle',
    title: 'Word Battle',
    shortTitle: 'Word Battle',
    category: 'Word',
    description:
      'Head-to-head 5-letter deduction race. Crack the target word in up to 6 attempts with color and icon tile feedback before your rival.',
    thumbnail: gameWordBattleImg,
    minPlayers: 2,
    maxPlayers: 6,
    enabled: true,
    featured: false,
    trending: true,
    statusLabel: 'Featured',
    avgDuration: '3 min',
    xpRewardWin: 125,
    coinRewardWin: 70,
    instructions: [
      'Guess the hidden 5-letter arena word within 6 attempts using your keyboard or touch keys.',
      'Exact letter & position tiles illuminate emerald with a checkmark; misplaced letters glow amber; absent letters dim.',
      'Fewer guesses and faster completion time award higher competitive score bonuses.',
      'In multiplayer rooms, everyone races to crack the same synchronized word.',
    ],
  },
];

export const DAILY_CHALLENGES: DailyChallenge[] = [
  {
    id: 'daily-play-3',
    title: 'Arena Warmup',
    description: 'Complete 3 matches in any enabled BWB ARENA title.',
    target: 3,
    metric: 'games_played',
    xpReward: 150,
    coinReward: 90,
  },
  {
    id: 'daily-win-2',
    title: 'Clutch Competitor',
    description: 'Secure 2 verified match victories today.',
    target: 2,
    metric: 'wins',
    xpReward: 220,
    coinReward: 140,
  },
  {
    id: 'daily-brain-win',
    title: 'Mind Games Specialist',
    description: 'Complete a match of Quiz Battle or Word Battle.',
    target: 1,
    metric: 'word_or_quiz',
    xpReward: 120,
    coinReward: 75,
    gameId: 'quiz-battle',
  },
];

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first-blood',
    title: 'First Victory',
    description: 'Win your first match inside BWB ARENA.',
    xpReward: 100,
    coinReward: 60,
    tier: 'Bronze',
    target: 1,
    metric: 'wins',
  },
  {
    id: 'arena-regular',
    title: 'Arena Regular',
    description: 'Complete 10 total matches across any game mode.',
    xpReward: 250,
    coinReward: 150,
    tier: 'Silver',
    target: 10,
    metric: 'gamesPlayed',
  },
  {
    id: 'hot-streak',
    title: 'Unstoppable Run',
    description: 'Build a 3-match winning streak.',
    xpReward: 300,
    coinReward: 200,
    tier: 'Gold',
    target: 3,
    metric: 'streak',
  },
  {
    id: 'squad-captain',
    title: 'Squad Captain',
    description: 'Connect with 3 friends on BWB ARENA.',
    xpReward: 180,
    coinReward: 110,
    tier: 'Bronze',
    target: 3,
    metric: 'friends',
  },
  {
    id: 'tier-veteran',
    title: 'Elite Contender',
    description: 'Reach Player Level 5 through verified match XP.',
    xpReward: 400,
    coinReward: 300,
    tier: 'Gold',
    target: 5,
    metric: 'level',
  },
  {
    id: 'apex-champion',
    title: 'BWB Apex Champion',
    description: 'Claim 25 competitive victories across the arena.',
    xpReward: 750,
    coinReward: 600,
    tier: 'Apex',
    target: 25,
    metric: 'wins',
  },
];

export const INITIAL_ANNOUNCEMENTS: PlatformAnnouncement[] = [
  {
    id: 'launch-season-1',
    title: 'Season 01: Vanguard Split Is Now Live',
    body: 'All five core multiplayer arenas are active with real-time room lobbies, friend invites, and verified seasonal leaderboards. Form a squad and claim daily challenge rewards.',
    pinned: true,
    breaking: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
    authorLabel: 'BWB ARENA Operations',
  },
  {
    id: 'fair-play-notice',
    title: 'Server-Validated Rankings & Fair Play',
    body: 'Competitive scores, XP, and arena coins are validated strictly on match completion. Use the Report action in room chat to flag unsportsmanlike behavior.',
    pinned: false,
    breaking: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 22,
    authorLabel: 'Fair Play Team',
  },
];

export const INITIAL_TOURNAMENTS: TournamentItem[] = [
  {
    id: 'tourn-quiz-clash',
    title: 'Weekend Quiz Blitz Open',
    gameId: 'quiz-battle',
    startsAt: Date.now() + 1000 * 60 * 60 * 18,
    prizeCoins: 2500,
    prizeXp: 1200,
    maxSlots: 32,
    registeredUids: {},
    format: 'Solo Bracket · 7 Rounds',
  },
  {
    id: 'tourn-word-masters',
    title: 'Word Battle Masters Cup',
    gameId: 'word-battle',
    startsAt: Date.now() + 1000 * 60 * 60 * 42,
    prizeCoins: 3000,
    prizeXp: 1500,
    maxSlots: 64,
    registeredUids: {},
    format: 'Swiss Elimination · Best of 3',
  },
  {
    id: 'tourn-sketch-royale',
    title: 'Can You Guess Creator Showdown',
    gameId: 'can-you-guess',
    startsAt: Date.now() + 1000 * 60 * 60 * 68,
    prizeCoins: 4000,
    prizeXp: 1800,
    maxSlots: 24,
    registeredUids: {},
    format: '8-Player Lobbies · Speed Scoring',
  },
];

// Used only when Firebase RTDB leaderboard has zero verified entries yet in Guest Practice preview
export const PRACTICE_LEADERBOARD_SAMPLE: LeaderboardEntry[] = [];
