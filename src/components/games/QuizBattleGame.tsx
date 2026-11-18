import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Flame, XCircle } from 'lucide-react';
import { QUIZ_QUESTION_BANK, scoreQuizAnswer } from '../../lib/gameRules';
import { arenaSound } from '../../lib/sound';
import type { ActiveGameSession, PlayerProfile } from '../../types/arena';
import type { GameFinishPayload } from './TicTacToeGame';

interface QuizBattleGameProps {
  session: ActiveGameSession;
  player: PlayerProfile;
  onUpdateSession: (patch: Record<string, unknown>) => Promise<void>;
  onFinish: (payload: GameFinishPayload) => void;
}

const TOTAL_QUESTIONS = 7;
const QUESTION_SECONDS = 15;

export function QuizBattleGame({ session, player, onUpdateSession, onFinish }: QuizBattleGameProps) {
  const seed = Number((session.state as { seed?: number }).seed ?? Date.now());
  const questions = useMemo(() => {
    const start = Math.abs(seed) % QUIZ_QUESTION_BANK.length;
    const rotated = [...QUIZ_QUESTION_BANK.slice(start), ...QUIZ_QUESTION_BANK.slice(0, start)];
    return rotated.slice(0, TOTAL_QUESTIONS);
  }, [seed]);

  const [qIdx, setQIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const currentQuestion = questions[qIdx];
  const opponent = Object.values(session.players).find((p) => p.uid !== player.uid);
  const opponentName = session.mode === 'multiplayer' ? opponent?.displayName || 'Room Challengers' : 'Quiz Rival Bot';

  const advanceQuestion = (finalScore: number, finalBotScore: number, finalCorrect: number) => {
    if (qIdx + 1 >= TOTAL_QUESTIONS) {
      setFinished(true);
      const outcome =
        finalScore > finalBotScore ? 'win' : finalScore < finalBotScore ? 'loss' : 'draw';
      if (outcome === 'win') arenaSound.victory();
      else arenaSound.defeat();

      onFinish({
        outcome,
        score: finalScore,
        opponentName,
        summary: `${finalCorrect}/${TOTAL_QUESTIONS} correct · Score ${finalScore} vs ${finalBotScore}`,
        winnerUid: outcome === 'win' ? player.uid : null,
      });
      return;
    }
    setQIdx((i) => i + 1);
    setSelectedIdx(null);
    setSecondsLeft(QUESTION_SECONDS);
  };

  // Per-question countdown
  useEffect(() => {
    if (finished || selectedIdx !== null) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setSelectedIdx(-1);
          setStreak(0);
          arenaSound.wrong();
          const botGain = Math.random() < 0.65 ? 120 : 0;
          const nextBot = botScore + botGain;
          setBotScore(nextBot);
          window.setTimeout(() => advanceQuestion(score, nextBot, correctCount), 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finished, selectedIdx, qIdx, score, botScore, correctCount]);

  const handleSelectOption = (optionIdx: number) => {
    if (finished || selectedIdx !== null) return;
    setSelectedIdx(optionIdx);

    const isCorrect = optionIdx === currentQuestion.correctIndex;
    const res = scoreQuizAnswer({
      correct: isCorrect,
      secondsRemaining: secondsLeft,
      maxSeconds: QUESTION_SECONDS,
      streakBefore: streak,
    });

    const nextScore = score + res.points;
    const nextCorrect = correctCount + (isCorrect ? 1 : 0);
    const botGain = session.mode === 'practice' && Math.random() < 0.62 ? 115 + Math.round(Math.random() * 55) : 0;
    const nextBot = session.mode === 'practice' ? botScore + botGain : opponent?.score ?? 0;

    if (isCorrect) arenaSound.correct();
    else arenaSound.wrong();

    setScore(nextScore);
    setCorrectCount(nextCorrect);
    setStreak(res.nextStreak);
    if (session.mode === 'practice') setBotScore(nextBot);

    if (session.mode === 'multiplayer') {
      onUpdateSession({ [`players/${player.uid}/score`]: nextScore }).catch(() => {});
    }

    window.setTimeout(() => advanceQuestion(nextScore, nextBot, nextCorrect), 1050);
  };

  // Keyboard shortcuts 1-4
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedIdx !== null || finished) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx <= 3) {
        handleSelectOption(idx);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIdx, finished, qIdx, secondsLeft, score, streak]);

  const progressPct = Math.max(0, Math.min(100, (secondsLeft / QUESTION_SECONDS) * 100));

  return (
    <div className="max-w-2xl mx-auto w-full space-y-5">
      {/* Live Scoreboard HUD */}
      <div className="arena-surface rounded-2xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted">{player.displayName}</p>
          <p className="font-mono text-2xl font-bold text-[#22D3EE] tabular-nums">{score}</p>
        </div>

        <div className="text-center">
          <p className="text-xs font-mono text-muted tabular-nums">
            Question {qIdx + 1} / {TOTAL_QUESTIONS}
          </p>
          <p className="text-xs font-semibold text-amber-400 inline-flex items-center gap-1 mt-0.5 tabular-nums">
            <Flame className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Streak x{Math.max(1, streak)}</span>
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-muted truncate">{opponentName}</p>
          <p className="font-mono text-2xl font-bold text-[#8B5CF6] tabular-nums">
            {session.mode === 'multiplayer' ? opponent?.score ?? 0 : botScore}
          </p>
        </div>
      </div>

      {/* Question Card */}
      <div className="arena-surface rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#22D3EE]">{currentQuestion.category}</span>
          <span
            className={`font-mono font-bold tabular-nums ${
              secondsLeft <= 4 ? 'text-[#EF4444]' : 'text-ink'
            }`}
          >
            {secondsLeft}s remaining
          </span>
        </div>

        <div className="h-1.5 w-full rounded-full bg-panel overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <h3 className="font-display text-xl sm:text-2xl font-bold text-ink leading-snug pt-1">
          {currentQuestion.prompt}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {currentQuestion.options.map((opt, idx) => {
            const isPicked = selectedIdx === idx;
            const isCorrect = idx === currentQuestion.correctIndex;
            const revealed = selectedIdx !== null;

            let btnStyle = 'bg-panel border-line hover:border-[#8B5CF6]/60 text-ink';
            if (revealed) {
              if (isCorrect) {
                btnStyle = 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]';
              } else if (isPicked && !isCorrect) {
                btnStyle = 'bg-[#EF4444]/15 border-[#EF4444] text-[#EF4444]';
              } else {
                btnStyle = 'bg-panel/40 border-line text-muted opacity-65';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={revealed || finished}
                onClick={() => handleSelectOption(idx)}
                className={`min-h-[56px] px-4 py-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.99] ${btnStyle}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-surface border border-line font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium leading-snug">{opt}</span>
                </div>
                {revealed && isCorrect && <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />}
                {revealed && isPicked && !isCorrect && <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
