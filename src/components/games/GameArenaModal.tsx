import { useEffect, useState } from 'react';
import { Award, Coins, MessageSquare, RotateCcw, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import { TicTacToeGame, type GameFinishPayload } from './TicTacToeGame';
import { RockPaperScissorsGame } from './RockPaperScissorsGame';
import { WordBattleGame } from './WordBattleGame';
import { QuizBattleGame } from './QuizBattleGame';
import { CanYouGuessGame } from './CanYouGuessGame';
import { RoomChatPanel } from '../chat/RoomChatPanel';

export function GameArenaModal() {
  const {
    activeSession,
    activeRoom,
    player,
    games,
    updateSessionState,
    completeMatch,
    closeActiveSession,
    launchPracticeGame,
    updatePreferences,
  } = useArena();

  const [resultModal, setResultModal] = useState<{
    payload: GameFinishPayload;
    xp: number;
    coins: number;
    validatedRemotely: boolean;
  } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (activeSession) {
      document.body.dataset.state = resultModal ? 'gameover' : 'playing';
    } else {
      delete document.body.dataset.state;
    }
    return () => {
      delete document.body.dataset.state;
    };
  }, [activeSession, resultModal]);

  if (!activeSession || !player) return null;

  const gameDef = games.find((g) => g.id === activeSession.gameId);

  const handleGameFinish = async (payload: GameFinishPayload) => {
    const reward = await completeMatch({
      gameId: activeSession.gameId,
      mode: activeSession.mode,
      outcome: payload.outcome,
      score: payload.score,
      opponentName: payload.opponentName,
      winnerUid: payload.winnerUid,
    });
    setResultModal({
      payload,
      xp: reward.xp,
      coins: reward.coins,
      validatedRemotely: reward.validatedRemotely,
    });
  };

  const handlePlayAgain = () => {
    const gId = activeSession.gameId;
    setResultModal(null);
    closeActiveSession();
    window.setTimeout(() => launchPracticeGame(gId), 20);
  };

  const handleExit = () => {
    setResultModal(null);
    closeActiveSession();
  };

  const toggleSound = () => {
    updatePreferences({
      soundPrefs: {
        ...player.soundPrefs,
        enabled: !player.soundPrefs.enabled,
      },
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${gameDef?.title || 'Arena'} live match`}
      className="fixed inset-0 z-50 bg-canvas flex flex-col overflow-hidden"
    >
      {/* Compact Unobtrusive Arena HUD Header */}
      <header className="h-14 px-4 sm:px-6 bg-panel border-b border-line flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="font-display text-base sm:text-lg font-bold text-ink truncate">
            {gameDef?.title || activeSession.gameId}
          </h2>
          <span className="text-xs text-muted hidden sm:inline">
            · {activeSession.mode === 'multiplayer' ? 'Live Multiplayer Room' : 'Practice Arena'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeRoom && (
            <button
              type="button"
              onClick={() => setChatOpen((o) => !o)}
              aria-label="Toggle live room chat"
              className={`h-9 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
                chatOpen
                  ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-ink'
                  : 'border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Room Chat</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleSound}
            aria-label={player.soundPrefs.enabled ? 'Mute game audio' : 'Unmute game audio'}
            className="w-9 h-9 rounded-xl border border-line bg-surface flex items-center justify-center text-muted hover:text-ink"
          >
            {player.soundPrefs.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleExit}
            aria-label="Exit game arena"
            className="h-9 px-3 rounded-xl border border-line bg-surface text-xs font-semibold text-muted hover:text-[#EF4444] inline-flex items-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Active Playfield */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-start justify-center">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row gap-5 items-start justify-center">
          <div className="flex-1 w-full">
            {activeSession.gameId === 'tic-tac-toe' && (
              <TicTacToeGame
                key={activeSession.sessionId}
                session={activeSession}
                player={player}
                onUpdateSession={updateSessionState}
                onFinish={handleGameFinish}
              />
            )}
            {activeSession.gameId === 'rock-paper-scissors' && (
              <RockPaperScissorsGame
                key={activeSession.sessionId}
                session={activeSession}
                player={player}
                onUpdateSession={updateSessionState}
                onFinish={handleGameFinish}
              />
            )}
            {activeSession.gameId === 'word-battle' && (
              <WordBattleGame
                key={activeSession.sessionId}
                session={activeSession}
                player={player}
                onUpdateSession={updateSessionState}
                onFinish={handleGameFinish}
              />
            )}
            {activeSession.gameId === 'quiz-battle' && (
              <QuizBattleGame
                key={activeSession.sessionId}
                session={activeSession}
                player={player}
                onUpdateSession={updateSessionState}
                onFinish={handleGameFinish}
              />
            )}
            {activeSession.gameId === 'can-you-guess' && (
              <CanYouGuessGame
                key={activeSession.sessionId}
                session={activeSession}
                player={player}
                onUpdateSession={updateSessionState}
                onFinish={handleGameFinish}
              />
            )}
          </div>

          {chatOpen && activeRoom && (
            <div className="w-full lg:w-[340px] shrink-0">
              <RoomChatPanel compact />
            </div>
          )}
        </div>
      </div>

      {/* Post-Match Outcome Modal */}
      {resultModal && (
        <div className="fixed inset-0 z-[60] bg-black/75 flex items-center justify-center p-4">
          <div className="arena-surface rounded-2xl w-full max-w-md p-6 text-center space-y-5 shadow-2xl">
            <div
              className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
                resultModal.payload.outcome === 'win'
                  ? 'bg-[#22C55E]/15 text-[#22C55E]'
                  : resultModal.payload.outcome === 'draw'
                    ? 'bg-amber-400/15 text-amber-400'
                    : 'bg-[#8B5CF6]/15 text-[#8B5CF6]'
              }`}
            >
              <Trophy className="w-7 h-7" aria-hidden="true" />
            </div>

            <div>
              <h3 className="font-display text-2xl font-extrabold text-ink">
                {resultModal.payload.outcome === 'win'
                  ? 'Victory Secured'
                  : resultModal.payload.outcome === 'draw'
                    ? 'Hard-Fought Draw'
                    : 'Match Complete'}
              </h3>
              <p className="text-sm text-muted mt-1">{resultModal.payload.summary}</p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl bg-panel border border-line p-3">
                <p className="text-[11px] text-muted">Score</p>
                <p className="font-mono text-lg font-bold text-ink tabular-nums mt-0.5">
                  {resultModal.payload.score}
                </p>
              </div>
              <div className="rounded-xl bg-panel border border-line p-3">
                <p className="text-[11px] text-muted inline-flex items-center justify-center gap-1">
                  <Award className="w-3 h-3 text-[#22D3EE]" aria-hidden="true" /> XP
                </p>
                <p className="font-mono text-lg font-bold text-[#22D3EE] tabular-nums mt-0.5">
                  +{resultModal.xp}
                </p>
              </div>
              <div className="rounded-xl bg-panel border border-line p-3">
                <p className="text-[11px] text-muted inline-flex items-center justify-center gap-1">
                  <Coins className="w-3 h-3 text-amber-400" aria-hidden="true" /> Coins
                </p>
                <p className="font-mono text-lg font-bold text-amber-400 tabular-nums mt-0.5">
                  +{resultModal.coins}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleExit}
                className="flex-1 h-11 rounded-xl border border-line bg-panel text-sm font-semibold text-ink hover:bg-surface-elevated"
              >
                Return to Arena
              </button>
              <button
                type="button"
                data-start="true"
                onClick={handlePlayAgain}
                className="flex-1 h-11 arena-gradient-btn rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
