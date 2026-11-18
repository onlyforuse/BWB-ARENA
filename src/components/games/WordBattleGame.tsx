import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Delete, HelpCircle, Minus } from 'lucide-react';
import {
  CLEAN_WORD_BANK,
  evaluateWordGuess,
  scoreWordBattleWin,
  type LetterTileState,
} from '../../lib/gameRules';
import { arenaSound } from '../../lib/sound';
import type { ActiveGameSession, PlayerProfile } from '../../types/arena';
import type { GameFinishPayload } from './TicTacToeGame';

interface WordBattleGameProps {
  session: ActiveGameSession;
  player: PlayerProfile;
  onUpdateSession: (patch: Record<string, unknown>) => Promise<void>;
  onFinish: (payload: GameFinishPayload) => void;
}

const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

const MAX_ATTEMPTS = 6;
const ROUND_TIME_SEC = 120;

export function WordBattleGame({ session, player, onUpdateSession, onFinish }: WordBattleGameProps) {
  const seed = Number((session.state as { seed?: number }).seed ?? Date.now());
  const targetWord = useMemo(
    () => CLEAN_WORD_BANK[Math.abs(seed) % CLEAN_WORD_BANK.length],
    [seed],
  );

  const [guesses, setGuesses] = useState<Array<{ word: string; evals: LetterTileState[] }>>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(ROUND_TIME_SEC);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const opponent = Object.values(session.players).find((p) => p.uid !== player.uid);
  const opponentName = session.mode === 'multiplayer' ? opponent?.displayName || 'Room Rivals' : 'Word Blitz Clock';

  // Countdown timer
  useEffect(() => {
    if (ended) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          setEnded(true);
          arenaSound.defeat();
          onFinish({
            outcome: 'loss',
            score: guesses.length * 35,
            opponentName,
            summary: `Time expired — target word was ${targetWord}`,
            winnerUid: null,
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [ended, guesses.length, onFinish, opponentName, targetWord]);

  const keyboardStates = useMemo(() => {
    const map: Record<string, LetterTileState> = {};
    const priority: Record<LetterTileState, number> = { absent: 1, present: 2, correct: 3 };
    guesses.forEach((g) => {
      g.word.split('').forEach((ch, idx) => {
        const nextState = g.evals[idx];
        const prev = map[ch];
        if (!prev || priority[nextState] > priority[prev]) {
          map[ch] = nextState;
        }
      });
    });
    return map;
  }, [guesses]);

  const submitGuess = useCallback(() => {
    if (ended) return;
    if (currentInput.length !== 5) {
      setStatusMsg('Enter a complete 5-letter word.');
      arenaSound.wrong();
      return;
    }
    const word = currentInput.toUpperCase();
    const evals = evaluateWordGuess(word, targetWord);
    const nextGuesses = [...guesses, { word, evals }];
    setGuesses(nextGuesses);
    setCurrentInput('');
    setStatusMsg(null);

    const solved = evals.every((e) => e === 'correct');
    if (solved) {
      setEnded(true);
      arenaSound.victory();
      const score = scoreWordBattleWin(nextGuesses.length, secondsLeft);
      if (session.mode === 'multiplayer') {
        onUpdateSession({ [`players/${player.uid}/score`]: score }).catch(() => {});
      }
      window.setTimeout(() => {
        onFinish({
          outcome: 'win',
          score,
          opponentName,
          summary: `Cracked "${targetWord}" in ${nextGuesses.length}/${MAX_ATTEMPTS} guesses with ${secondsLeft}s remaining`,
          winnerUid: player.uid,
        });
      }, 650);
    } else if (nextGuesses.length >= MAX_ATTEMPTS) {
      setEnded(true);
      arenaSound.defeat();
      const partialCorrect = nextGuesses.reduce(
        (acc, g) => acc + g.evals.filter((s) => s === 'correct').length,
        0,
      );
      window.setTimeout(() => {
        onFinish({
          outcome: 'loss',
          score: partialCorrect * 25,
          opponentName,
          summary: `Out of attempts — target word was "${targetWord}"`,
          winnerUid: null,
        });
      }, 650);
    } else {
      arenaSound.move();
    }
  }, [ended, currentInput, targetWord, guesses, secondsLeft, session.mode, player.uid, onUpdateSession, onFinish, opponentName]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (ended) return;
      if (key === 'ENTER') {
        submitGuess();
      } else if (key === 'BACK' || key === 'BACKSPACE') {
        setCurrentInput((prev) => prev.slice(0, -1));
        setStatusMsg(null);
      } else if (/^[A-Z]$/.test(key) && currentInput.length < 5) {
        setCurrentInput((prev) => prev + key);
        setStatusMsg(null);
        arenaSound.click();
      }
    },
    [ended, currentInput.length, submitGuess],
  );

  // Physical keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleKeyPress('ENTER');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeyPress('BACK');
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKeyPress(e.key.toUpperCase());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKeyPress]);

  return (
    <div className="max-w-lg mx-auto w-full space-y-4">
      {/* Top Word HUD */}
      <div className="arena-surface rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Attempts</p>
          <p className="font-mono text-base font-bold text-ink tabular-nums">
            {guesses.length} / {MAX_ATTEMPTS}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted">Legend</p>
          <p className="text-[11px] text-ink">
            <span className="text-[#22C55E] font-semibold">Exact</span> ·{' '}
            <span className="text-amber-400 font-semibold">Misplaced</span> ·{' '}
            <span className="text-muted">Miss</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Clock</p>
          <p
            className={`font-mono text-base font-bold tabular-nums ${
              secondsLeft <= 20 ? 'text-[#EF4444]' : 'text-[#22D3EE]'
            }`}
          >
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </p>
        </div>
      </div>

      {statusMsg && (
        <p role="alert" className="text-center text-xs font-medium text-amber-400">
          {statusMsg}
        </p>
      )}

      {/* 6 x 5 Letter Grid */}
      <div className="grid grid-rows-6 gap-2 max-w-[330px] mx-auto" aria-label="Word Battle grid">
        {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIdx) => {
          const submitted = guesses[rowIdx];
          const isCurrent = rowIdx === guesses.length && !ended;
          const letters = submitted
            ? submitted.word.split('')
            : isCurrent
              ? currentInput.padEnd(5, ' ').split('')
              : Array(5).fill(' ');

          return (
            <div key={rowIdx} className="grid grid-cols-5 gap-2">
              {letters.map((ch, colIdx) => {
                const state = submitted?.evals[colIdx];
                const stateClass =
                  state === 'correct'
                    ? 'bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E]'
                    : state === 'present'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : state === 'absent'
                        ? 'bg-panel border-line text-muted'
                        : ch.trim()
                          ? 'bg-surface-elevated border-[#8B5CF6] text-ink'
                          : 'bg-panel/60 border-line text-ink';

                return (
                  <div
                    key={colIdx}
                    aria-label={
                      submitted
                        ? `${ch} ${state === 'correct' ? 'exact position' : state === 'present' ? 'wrong position' : 'absent'}`
                        : ch.trim() || 'empty'
                    }
                    className={`relative aspect-square rounded-xl border-2 font-display text-xl sm:text-2xl font-extrabold flex items-center justify-center select-none transition-colors ${stateClass}`}
                  >
                    <span>{ch.trim()}</span>
                    {state === 'correct' && (
                      <Check className="w-2.5 h-2.5 absolute bottom-1 right-1 opacity-85" aria-hidden="true" />
                    )}
                    {state === 'present' && (
                      <HelpCircle className="w-2.5 h-2.5 absolute bottom-1 right-1 opacity-85" aria-hidden="true" />
                    )}
                    {state === 'absent' && (
                      <Minus className="w-2.5 h-2.5 absolute bottom-1 right-1 opacity-50" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Touch & Desktop On-Screen Keyboard */}
      <div className="space-y-1.5 pt-1" aria-label="On-screen keyboard">
        {KEY_ROWS.map((row, rIdx) => (
          <div key={rIdx} className="flex items-center justify-center gap-1 sm:gap-1.5">
            {row.map((key) => {
              const st = keyboardStates[key];
              const isAction = key === 'ENTER' || key === 'BACK';
              const keyBg =
                st === 'correct'
                  ? 'bg-[#22C55E] text-[#080A12] border-[#22C55E]'
                  : st === 'present'
                    ? 'bg-amber-400 text-[#080A12] border-amber-400'
                    : st === 'absent'
                      ? 'bg-panel/50 text-muted/60 border-line'
                      : isAction
                        ? 'bg-[#8B5CF6]/20 text-ink border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/35'
                        : 'bg-surface text-ink border-line hover:border-[#8B5CF6]/50';

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeyPress(key)}
                  aria-label={key === 'BACK' ? 'Backspace' : key === 'ENTER' ? 'Submit guess' : `Letter ${key}`}
                  className={`h-11 sm:h-12 rounded-xl border font-mono text-xs sm:text-sm font-bold flex items-center justify-center transition-colors active:scale-95 select-none ${
                    isAction ? 'px-2.5 sm:px-3.5 min-w-[52px]' : 'flex-1 max-w-[42px]'
                  } ${keyBg}`}
                >
                  {key === 'BACK' ? <Delete className="w-4 h-4" /> : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
