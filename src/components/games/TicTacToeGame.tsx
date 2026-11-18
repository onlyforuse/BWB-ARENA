import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Shield, Sparkles } from 'lucide-react';
import { evaluateTicTacToe, getBestTicTacToeMove, type TttMark } from '../../lib/gameRules';
import { arenaSound } from '../../lib/sound';
import type { ActiveGameSession, PlayerProfile } from '../../types/arena';

export interface GameFinishPayload {
  outcome: 'win' | 'loss' | 'draw';
  score: number;
  opponentName: string;
  summary: string;
  winnerUid?: string | null;
}

interface TicTacToeGameProps {
  session: ActiveGameSession;
  player: PlayerProfile;
  onUpdateSession: (patch: Record<string, unknown>) => Promise<void>;
  onFinish: (payload: GameFinishPayload) => void;
}

export function TicTacToeGame({ session, player, onUpdateSession, onFinish }: TicTacToeGameProps) {
  const isMultiplayer = session.mode === 'multiplayer';
  const [difficulty, setDifficulty] = useState<'casual' | 'pro'>('casual');

  // Local practice state (best-of-3 series -> first to 2 round wins)
  const [board, setBoard] = useState<TttMark[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<'X' | 'O'>('X');
  const [round, setRound] = useState(1);
  const [playerWins, setPlayerWins] = useState(0);
  const [botWins, setBotWins] = useState(0);
  const [roundBanner, setRoundBanner] = useState<string | null>(null);
  const [seriesComplete, setSeriesComplete] = useState(false);

  // Multiplayer derived state from RTDB session
  const mpState = session.state as {
    board?: string[];
    xUid?: string;
    oUid?: string;
    turnUid?: string;
    round?: number;
    scores?: Record<string, number>;
  };

  const activeBoard: TttMark[] = useMemo(() => {
    if (!isMultiplayer) return board;
    const raw = Array.isArray(mpState.board) ? mpState.board : Array(9).fill('');
    return raw.map((c) => (c === 'X' || c === 'O' ? c : null));
  }, [isMultiplayer, board, mpState.board]);

  const myMark: 'X' | 'O' = isMultiplayer ? (mpState.xUid === player.uid ? 'X' : 'O') : 'X';
  const opponentPlayer = Object.values(session.players).find((p) => p.uid !== player.uid);
  const opponentName = isMultiplayer
    ? opponentPlayer?.displayName || 'Opponent'
    : difficulty === 'pro'
      ? 'Minimax Pro Bot'
      : 'Arena Practice Bot';

  const evalResult = useMemo(() => evaluateTicTacToe(activeBoard), [activeBoard]);
  const isMyTurn = isMultiplayer ? mpState.turnUid === player.uid : turn === 'X';

  // Solo practice bot move effect
  useEffect(() => {
    if (isMultiplayer || seriesComplete || roundBanner || turn !== 'O') return;
    const timer = window.setTimeout(() => {
      const move = getBestTicTacToeMove(board, 'O', difficulty);
      if (move === -1) return;
      const next = [...board];
      next[move] = 'O';
      arenaSound.move();
      setBoard(next);
      const check = evaluateTicTacToe(next);
      if (check.winner) {
        handlePracticeRoundEnd(check.winner);
      } else {
        setTurn('X');
      }
    }, 480);
    return () => window.clearTimeout(timer);
  }, [isMultiplayer, seriesComplete, roundBanner, turn, board, difficulty]);

  const handlePracticeRoundEnd = (winner: 'X' | 'O' | 'draw') => {
    let nextP = playerWins;
    let nextB = botWins;
    if (winner === 'X') {
      nextP += 1;
      setPlayerWins(nextP);
      arenaSound.correct();
      setRoundBanner('You claimed the round!');
    } else if (winner === 'O') {
      nextB += 1;
      setBotWins(nextB);
      arenaSound.wrong();
      setRoundBanner(`${opponentName} took the round.`);
    } else {
      arenaSound.click();
      setRoundBanner('Round ended in a stalemate.');
    }

    if (nextP >= 2 || nextB >= 2) {
      setSeriesComplete(true);
      const outcome = nextP > nextB ? 'win' : 'loss';
      window.setTimeout(() => {
        onFinish({
          outcome,
          score: nextP * 200 + (outcome === 'win' ? 150 : 40),
          opponentName,
          summary: `Series Score ${nextP} – ${nextB} (${difficulty === 'pro' ? 'Pro' : 'Casual'} Tier)`,
          winnerUid: outcome === 'win' ? player.uid : null,
        });
      }, 650);
    }
  };

  const startNextPracticeRound = () => {
    arenaSound.click();
    setBoard(Array(9).fill(null));
    setRound((r) => r + 1);
    setRoundBanner(null);
    setTurn(round % 2 === 1 ? 'O' : 'X');
  };

  const handleCellClick = async (idx: number) => {
    if (activeBoard[idx] !== null || evalResult.winner || seriesComplete || roundBanner) return;
    if (!isMyTurn) return;

    arenaSound.move();

    if (!isMultiplayer) {
      const next = [...board];
      next[idx] = 'X';
      setBoard(next);
      const check = evaluateTicTacToe(next);
      if (check.winner) {
        handlePracticeRoundEnd(check.winner);
      } else {
        setTurn('O');
      }
      return;
    }

    // Multiplayer RTDB move update
    const nextBoard = activeBoard.map((c, i) => (i === idx ? myMark : c || ''));
    const check = evaluateTicTacToe(nextBoard.map((c) => (c === 'X' || c === 'O' ? c : null)));
    const nextTurnUid = mpState.xUid === player.uid ? mpState.oUid : mpState.xUid;
    const scores = { ...(mpState.scores || {}) };

    if (check.winner === 'X' && mpState.xUid) {
      scores[mpState.xUid] = (scores[mpState.xUid] || 0) + 1;
    } else if (check.winner === 'O' && mpState.oUid) {
      scores[mpState.oUid] = (scores[mpState.oUid] || 0) + 1;
    }

    await onUpdateSession({
      'state/board': nextBoard,
      'state/turnUid': nextTurnUid,
      'state/scores': scores,
    });

    const p1Score = mpState.xUid ? scores[mpState.xUid] || 0 : 0;
    const p2Score = mpState.oUid ? scores[mpState.oUid] || 0 : 0;

    if (p1Score >= 2 || p2Score >= 2) {
      const winnerUid = p1Score >= 2 ? mpState.xUid || null : mpState.oUid || null;
      const outcome = winnerUid === player.uid ? 'win' : 'loss';
      window.setTimeout(() => {
        onFinish({
          outcome,
          score: (scores[player.uid] || 0) * 240 + (outcome === 'win' ? 200 : 60),
          opponentName,
          summary: `Multiplayer Series ${p1Score} – ${p2Score}`,
          winnerUid,
        });
      }, 650);
    } else if (check.winner) {
      window.setTimeout(() => {
        onUpdateSession({
          'state/board': Array(9).fill(''),
          'state/round': (mpState.round || 1) + 1,
          'state/turnUid': (mpState.round || 1) % 2 === 1 ? mpState.oUid : mpState.xUid,
        });
      }, 1100);
    }
  };

  const myDisplayScore = isMultiplayer ? mpState.scores?.[player.uid] ?? 0 : playerWins;
  const oppDisplayScore = isMultiplayer
    ? opponentPlayer
      ? mpState.scores?.[opponentPlayer.uid] ?? 0
      : 0
    : botWins;

  return (
    <div className="max-w-xl mx-auto w-full space-y-5">
      {/* Match HUD Strip */}
      <div className="arena-surface rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/35 flex items-center justify-center font-display text-lg font-extrabold text-[#3B82F6]">
            {myMark}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted truncate">{player.displayName}</p>
            <p className="font-mono text-xl font-bold text-ink tabular-nums">{myDisplayScore} / 2</p>
          </div>
        </div>

        <div className="text-center shrink-0">
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted">
            Round {isMultiplayer ? mpState.round || 1 : round}
          </p>
          <p className="text-xs font-semibold text-[#22D3EE] mt-0.5">
            {seriesComplete ? 'Match Complete' : isMyTurn ? 'Your Turn' : `${opponentName}'s Turn`}
          </p>
        </div>

        <div className="flex items-center gap-3 min-w-0 text-right">
          <div className="min-w-0">
            <p className="text-xs text-muted truncate">{opponentName}</p>
            <p className="font-mono text-xl font-bold text-ink tabular-nums">{oppDisplayScore} / 2</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/35 flex items-center justify-center font-display text-lg font-extrabold text-[#8B5CF6]">
            {myMark === 'X' ? 'O' : 'X'}
          </div>
        </div>
      </div>

      {/* Practice Difficulty Toggle */}
      {!isMultiplayer && (
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-xs text-muted inline-flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#8B5CF6]" aria-hidden="true" />
            Best of 3 Series
          </span>
          <div className="inline-flex items-center p-1 rounded-xl bg-panel border border-line">
            <button
              type="button"
              onClick={() => setDifficulty('casual')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                difficulty === 'casual' ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
              }`}
            >
              Casual Bot
            </button>
            <button
              type="button"
              onClick={() => setDifficulty('pro')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                difficulty === 'pro' ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
              }`}
            >
              Pro Minimax
            </button>
          </div>
        </div>
      )}

      {/* 3x3 Obsidian Arena Board */}
      <div
        role="grid"
        aria-label="Tic Tac Toe board"
        className="arena-surface rounded-3xl p-4 sm:p-6 grid grid-cols-3 gap-3 sm:gap-4 aspect-square max-w-[380px] mx-auto"
      >
        {activeBoard.map((mark, index) => {
          const isWinningCell = evalResult.line?.includes(index) ?? false;
          const row = Math.floor(index / 3) + 1;
          const col = (index % 3) + 1;

          return (
            <button
              key={index}
              type="button"
              disabled={Boolean(mark) || !isMyTurn || Boolean(evalResult.winner) || Boolean(roundBanner)}
              onClick={() => handleCellClick(index)}
              aria-label={`Row ${row}, Column ${col}${mark ? `, marked ${mark}` : ', empty'}`}
              className={`rounded-2xl border text-4xl sm:text-5xl font-display font-extrabold flex items-center justify-center transition-all duration-150 select-none min-h-[76px] ${
                isWinningCell
                  ? 'bg-[#22C55E]/15 border-[#22C55E] scale-[1.02]'
                  : mark
                    ? 'bg-panel border-line'
                    : isMyTurn
                      ? 'bg-panel/70 border-line hover:border-[#22D3EE]/60 hover:bg-surface-elevated active:scale-95 cursor-pointer'
                      : 'bg-panel/40 border-line cursor-not-allowed'
              }`}
            >
              {mark === 'X' && <span className="text-[#3B82F6] drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]">X</span>}
              {mark === 'O' && <span className="text-[#8B5CF6] drop-shadow-[0_0_12px_rgba(139,92,246,0.5)]">O</span>}
            </button>
          );
        })}
      </div>

      {/* Round Transition Banner */}
      {roundBanner && !seriesComplete && (
        <div className="arena-surface rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#22D3EE]" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">{roundBanner}</p>
          </div>
          <button
            type="button"
            onClick={startNextPracticeRound}
            className="arena-gradient-btn px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Next Round</span>
          </button>
        </div>
      )}
    </div>
  );
}
