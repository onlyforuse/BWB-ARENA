import { useState } from 'react';
import { Hand, Mountain, Scissors } from 'lucide-react';
import { pickAdaptiveRpsBotMove, resolveRpsRound, type RpsChoice } from '../../lib/gameRules';
import { arenaSound } from '../../lib/sound';
import type { ActiveGameSession, PlayerProfile } from '../../types/arena';
import type { GameFinishPayload } from './TicTacToeGame';

interface RpsGameProps {
  session: ActiveGameSession;
  player: PlayerProfile;
  onUpdateSession: (patch: Record<string, unknown>) => Promise<void>;
  onFinish: (payload: GameFinishPayload) => void;
}

const CHOICES: Array<{
  id: RpsChoice;
  label: string;
  beats: string;
  icon: typeof Mountain;
  accent: string;
}> = [
  { id: 'rock', label: 'Rock', beats: 'Crushes Scissors', icon: Mountain, accent: 'text-[#8B5CF6] border-[#8B5CF6]/45' },
  { id: 'paper', label: 'Paper', beats: 'Covers Rock', icon: Hand, accent: 'text-[#3B82F6] border-[#3B82F6]/45' },
  { id: 'scissors', label: 'Scissors', beats: 'Cuts Paper', icon: Scissors, accent: 'text-[#22D3EE] border-[#22D3EE]/45' },
];

interface RoundLogItem {
  round: number;
  mine: RpsChoice;
  theirs: RpsChoice;
  result: 'win' | 'loss' | 'draw';
}

export function RockPaperScissorsGame({ session, player, onUpdateSession, onFinish }: RpsGameProps) {
  const isMultiplayer = session.mode === 'multiplayer';
  const opponent = Object.values(session.players).find((p) => p.uid !== player.uid);
  const opponentName = isMultiplayer ? opponent?.displayName || 'Opponent' : 'Adaptive Duelist Bot';

  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<RoundLogItem[]>([]);
  const [lockedChoice, setLockedChoice] = useState<RpsChoice | null>(null);
  const [lastReveal, setLastReveal] = useState<RoundLogItem | null>(null);
  const [finished, setFinished] = useState(false);

  const mpState = session.state as {
    round?: number;
    choices?: Record<string, RpsChoice>;
    scores?: Record<string, number>;
  };

  const handleSelectChoice = async (choice: RpsChoice) => {
    if (finished || lockedChoice) return;
    arenaSound.move();
    setLockedChoice(choice);

    if (isMultiplayer && opponent) {
      const nextChoices = { ...(mpState.choices || {}), [player.uid]: choice };
      await onUpdateSession({ [`state/choices/${player.uid}`]: choice });

      const oppChoice = nextChoices[opponent.uid];
      if (oppChoice) {
        const res = resolveRpsRound(choice, oppChoice);
        const scores = { ...(mpState.scores || {}) };
        if (res === 'p1') scores[player.uid] = (scores[player.uid] || 0) + 1;
        if (res === 'p2') scores[opponent.uid] = (scores[opponent.uid] || 0) + 1;

        const mapped: RoundLogItem = {
          round: history.length + 1,
          mine: choice,
          theirs: oppChoice,
          result: res === 'p1' ? 'win' : res === 'p2' ? 'loss' : 'draw',
        };
        setLastReveal(mapped);
        setHistory((prev) => [mapped, ...prev]);
        setMyScore(scores[player.uid] || 0);
        setOppScore(scores[opponent.uid] || 0);

        await onUpdateSession({
          'state/scores': scores,
          'state/choices': {},
          'state/round': (mpState.round || 1) + 1,
        });

        window.setTimeout(() => {
          setLockedChoice(null);
          if ((scores[player.uid] || 0) >= 3 || (scores[opponent.uid] || 0) >= 3) {
            setFinished(true);
            const didWin = (scores[player.uid] || 0) >= 3;
            onFinish({
              outcome: didWin ? 'win' : 'loss',
              score: (scores[player.uid] || 0) * 180 + (didWin ? 140 : 40),
              opponentName,
              summary: `Best-of-5 Duel ${scores[player.uid] || 0} – ${scores[opponent.uid] || 0}`,
              winnerUid: didWin ? player.uid : opponent.uid,
            });
          }
        }, 700);
      } else {
        // Waiting on opponent lock
        window.setTimeout(() => setLockedChoice(null), 1500);
      }
      return;
    }

    // Practice mode simultaneous reveal
    const botMove = pickAdaptiveRpsBotMove(history.map((h) => h.mine));
    window.setTimeout(() => {
      const outcome = resolveRpsRound(choice, botMove);
      const nextMy = myScore + (outcome === 'p1' ? 1 : 0);
      const nextOpp = oppScore + (outcome === 'p2' ? 1 : 0);
      const nextStreak = outcome === 'p1' ? streak + 1 : outcome === 'p2' ? 0 : streak;
      const entry: RoundLogItem = {
        round: history.length + 1,
        mine: choice,
        theirs: botMove,
        result: outcome === 'p1' ? 'win' : outcome === 'p2' ? 'loss' : 'draw',
      };

      if (outcome === 'p1') arenaSound.correct();
      else if (outcome === 'p2') arenaSound.wrong();
      else arenaSound.click();

      setMyScore(nextMy);
      setOppScore(nextOpp);
      setStreak(nextStreak);
      setLastReveal(entry);
      setHistory((prev) => [entry, ...prev]);
      setLockedChoice(null);

      if (nextMy >= 3 || nextOpp >= 3) {
        setFinished(true);
        const won = nextMy >= 3;
        window.setTimeout(() => {
          onFinish({
            outcome: won ? 'win' : 'loss',
            score: nextMy * 160 + nextStreak * 40 + (won ? 120 : 30),
            opponentName,
            summary: `Best-of-5 Series ${nextMy} – ${nextOpp} (${history.length + 1} rounds played)`,
            winnerUid: won ? player.uid : null,
          });
        }, 650);
      }
    }, 360);
  };

  return (
    <div className="max-w-2xl mx-auto w-full space-y-5">
      {/* Scoreboard Strip */}
      <div className="arena-surface rounded-2xl p-4 grid grid-cols-3 items-center gap-3">
        <div>
          <p className="text-xs text-muted truncate">{player.displayName}</p>
          <p className="font-mono text-2xl font-bold text-[#22D3EE] tabular-nums">{myScore} / 3</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted">First to 3 Wins</p>
          <p className="text-xs font-semibold text-ink mt-0.5 tabular-nums">
            Round {history.length + 1} · Streak {streak}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted truncate">{opponentName}</p>
          <p className="font-mono text-2xl font-bold text-[#8B5CF6] tabular-nums">{oppScore} / 3</p>
        </div>
      </div>

      {/* Clash Reveal Stage */}
      <div className="arena-surface rounded-2xl p-6 text-center min-h-[156px] flex flex-col items-center justify-center gap-3">
        {lastReveal ? (
          <>
            <div className="flex items-center justify-center gap-6 sm:gap-10">
              <div className="text-center">
                <p className="text-xs text-muted mb-1">Your Lock</p>
                <p className="font-display text-2xl font-extrabold uppercase text-[#22D3EE]">{lastReveal.mine}</p>
              </div>
              <span className="font-mono text-sm font-bold text-muted">VS</span>
              <div className="text-center">
                <p className="text-xs text-muted mb-1">{opponentName}</p>
                <p className="font-display text-2xl font-extrabold uppercase text-[#8B5CF6]">{lastReveal.theirs}</p>
              </div>
            </div>
            <p
              className={`text-sm font-semibold ${
                lastReveal.result === 'win'
                  ? 'text-[#22C55E]'
                  : lastReveal.result === 'loss'
                    ? 'text-[#EF4444]'
                    : 'text-amber-400'
              }`}
            >
              {lastReveal.result === 'win'
                ? 'Round Won — Counter Confirmed'
                : lastReveal.result === 'loss'
                  ? 'Round Lost — Read Their Next Pattern'
                  : 'Tie — Re-lock Immediately'}
            </p>
          </>
        ) : (
          <div className="space-y-1">
            <p className="font-display text-lg font-bold text-ink">Select Your Opening Emblem</p>
            <p className="text-xs text-muted">Moves lock simultaneously before revealing.</p>
          </div>
        )}
      </div>

      {/* Touch-Friendly Move Selector */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {CHOICES.map((c) => {
          const Icon = c.icon;
          const isSelected = lockedChoice === c.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={Boolean(lockedChoice) || finished}
              onClick={() => handleSelectChoice(c.id)}
              className={`arena-surface rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center gap-2.5 text-center transition-all min-h-[120px] active:scale-95 ${
                isSelected
                  ? 'border-[#22D3EE] bg-[#22D3EE]/10'
                  : 'hover:border-[#8B5CF6]/55 hover:bg-surface-elevated'
              } disabled:opacity-65`}
            >
              <div className={`w-12 h-12 rounded-xl bg-panel border flex items-center justify-center ${c.accent}`}>
                <Icon className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-base font-bold text-ink">{c.label}</p>
                <p className="text-[11px] text-muted mt-0.5 hidden sm:block">{c.beats}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Round History */}
      {history.length > 0 && (
        <div className="arena-surface rounded-2xl p-4">
          <p className="text-xs font-semibold text-muted mb-2.5">Match Round Log</p>
          <div className="divide-y divide-line">
            {history.slice(0, 5).map((item) => (
              <div key={item.round} className="py-2 flex items-center justify-between text-xs">
                <span className="font-mono text-muted tabular-nums">Round {item.round}</span>
                <span className="text-ink font-medium capitalize">
                  {item.mine} vs {item.theirs}
                </span>
                <span
                  className={`font-semibold uppercase ${
                    item.result === 'win'
                      ? 'text-[#22C55E]'
                      : item.result === 'loss'
                        ? 'text-[#EF4444]'
                        : 'text-amber-400'
                  }`}
                >
                  {item.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
