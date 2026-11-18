import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLevelFromXp,
  calculateMatchRewards,
  calculateWinRate,
  canJoinRoom,
  checkDrawingGuess,
  evaluateTicTacToe,
  evaluateWordGuess,
  generateRoomCode,
  getBestTicTacToeMove,
  isRateLimited,
  normalizeRoomCode,
  resolveRpsRound,
  sanitizeChatMessage,
  scoreQuizAnswer,
  scoreWordBattleWin,
  validateRegistrationForm,
  validateUsername,
} from './gameRules';

test('username and registration form validation enforce security and uniqueness rules', () => {
  assert.equal(validateUsername('satyam_07'), null);
  assert.ok(validateUsername('ab'));
  assert.ok(validateUsername('bad name!'));
  assert.ok(validateUsername('admin'));

  const errors = validateRegistrationForm({
    fullName: 'S',
    username: 'admin',
    email: 'invalid-email',
    password: '123',
    confirmPassword: '456',
  });
  assert.ok(errors.fullName);
  assert.ok(errors.username);
  assert.ok(errors.email);
  assert.ok(errors.password);
  assert.ok(errors.confirmPassword);

  const valid = validateRegistrationForm({
    fullName: 'Satyam Kumar',
    username: 'satyam_bwb',
    email: 'player@bwbarena.com',
    password: 'strongpassword',
    confirmPassword: 'strongpassword',
  });
  assert.deepEqual(valid, {});
});

test('room code generation, normalization, and capacity checks work deterministically', () => {
  const code = generateRoomCode(() => 0.1);
  assert.equal(code.length, 6);
  assert.equal(normalizeRoomCode(' bwb-7k! '), 'BWB7K');

  assert.equal(
    canJoinRoom({ status: 'waiting', currentCount: 2, maxPlayers: 4, alreadyInRoom: false }).allowed,
    true,
  );
  assert.equal(
    canJoinRoom({ status: 'waiting', currentCount: 4, maxPlayers: 4, alreadyInRoom: false }).allowed,
    false,
  );
  assert.equal(
    canJoinRoom({ status: 'in_game', currentCount: 2, maxPlayers: 4, alreadyInRoom: false }).allowed,
    false,
  );
  assert.equal(
    canJoinRoom({ status: 'in_game', currentCount: 4, maxPlayers: 4, alreadyInRoom: true }).allowed,
    true,
  );
});

test('XP progression, win rate, and match rewards compute cleanly', () => {
  const lvl1 = calculateLevelFromXp(0);
  assert.equal(lvl1.level, 1);
  assert.equal(lvl1.progressPercent, 0);

  const lvl2 = calculateLevelFromXp(250);
  assert.equal(lvl2.level, 2);

  assert.equal(calculateWinRate(3, 4), 75);
  assert.equal(calculateWinRate(0, 0), 0);

  const mpWin = calculateMatchRewards({ gameId: 'quiz-battle', outcome: 'win', mode: 'multiplayer', score: 500 });
  const practiceWin = calculateMatchRewards({ gameId: 'quiz-battle', outcome: 'win', mode: 'practice', score: 500 });
  assert.ok(mpWin.xp > practiceWin.xp);
  assert.ok(mpWin.coins > practiceWin.coins);
});

test('Tic Tac Toe detects wins, draws, and Pro Minimax blocks immediate threats', () => {
  const winCheck = evaluateTicTacToe(['X', 'X', 'X', null, 'O', null, null, null, 'O']);
  assert.equal(winCheck.winner, 'X');
  assert.deepEqual(winCheck.line, [0, 1, 2]);

  const drawCheck = evaluateTicTacToe(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']);
  assert.equal(drawCheck.winner, 'draw');

  // X threatens index 2; O must block at index 2
  const blockMove = getBestTicTacToeMove(['X', 'X', null, null, 'O', null, null, null, null], 'O', 'pro');
  assert.equal(blockMove, 2);
});

test('Rock Paper Scissors resolves all matchups accurately', () => {
  assert.equal(resolveRpsRound('rock', 'scissors'), 'p1');
  assert.equal(resolveRpsRound('paper', 'rock'), 'p1');
  assert.equal(resolveRpsRound('scissors', 'paper'), 'p1');
  assert.equal(resolveRpsRound('rock', 'paper'), 'p2');
  assert.equal(resolveRpsRound('scissors', 'scissors'), 'draw');
});

test('Word Battle evaluates exact, present, absent, and duplicate letters properly', () => {
  assert.deepEqual(evaluateWordGuess('ARENA', 'ARENA'), [
    'correct',
    'correct',
    'correct',
    'correct',
    'correct',
  ]);

  // Duplicate letter edge case: target SPEED has two E's at indices 2,3; guess EERIE has three E's
  assert.deepEqual(evaluateWordGuess('EERIE', 'SPEED'), [
    'present', // first E matches one remaining E
    'present', // second E matches second remaining E
    'absent',  // R absent
    'absent',  // I absent
    'absent',  // third E should be absent since only two E's exist in SPEED
  ]);

  assert.ok(scoreWordBattleWin(2, 60) > scoreWordBattleWin(5, 10));
});

test('Quiz Battle and Can You Guess scoring and chat rate limiting work accurately', () => {
  const q1 = scoreQuizAnswer({ correct: true, secondsRemaining: 12, maxSeconds: 15, streakBefore: 2 });
  assert.equal(q1.nextStreak, 3);
  assert.ok(q1.points > 180);

  const qWrong = scoreQuizAnswer({ correct: false, secondsRemaining: 10, maxSeconds: 15, streakBefore: 3 });
  assert.equal(qWrong.points, 0);
  assert.equal(qWrong.nextStreak, 0);

  assert.equal(checkDrawingGuess('rocket', 'ROCKET'), 'exact');
  assert.equal(checkDrawingGuess('rocke', 'ROCKET'), 'close');
  assert.equal(checkDrawingGuess('shield', 'ROCKET'), 'miss');

  assert.equal(sanitizeChatMessage('   ').valid, false);
  assert.equal(sanitizeChatMessage('GG everyone!').valid, true);
  assert.equal(isRateLimited(1000, 1500, 1200), true);
  assert.equal(isRateLimited(1000, 2500, 1200), false);
});
