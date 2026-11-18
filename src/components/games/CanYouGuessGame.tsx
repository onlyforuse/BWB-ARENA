import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, Paintbrush, Send, Trash2, Undo2 } from 'lucide-react';
import {
  checkDrawingGuess,
  DRAWING_PROMPTS,
  scoreDrawingGuess,
} from '../../lib/gameRules';
import { arenaSound } from '../../lib/sound';
import type { ActiveGameSession, DrawStroke, PlayerProfile } from '../../types/arena';
import type { GameFinishPayload } from './TicTacToeGame';

interface CanYouGuessGameProps {
  session: ActiveGameSession;
  player: PlayerProfile;
  onUpdateSession: (patch: Record<string, unknown>) => Promise<void>;
  onFinish: (payload: GameFinishPayload) => void;
}

const SWATCHES = ['#F8FAFC', '#22D3EE', '#8B5CF6', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444'];
const BRUSH_SIZES = [3, 6, 11];
const ROUND_SECONDS = 55;
const TOTAL_ROUNDS = 3;

export function CanYouGuessGame({ session, player, onUpdateSession, onFinish }: CanYouGuessGameProps) {
  const isMultiplayer = session.mode === 'multiplayer';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<DrawStroke | null>(null);

  const [modeTab, setModeTab] = useState<'guess' | 'draw'>(isMultiplayer && session.hostUid === player.uid ? 'draw' : 'guess');
  const [roundIdx, setRoundIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [botProgressStrokes, setBotProgressStrokes] = useState<DrawStroke[]>([]);
  const [brushColor, setBrushColor] = useState(SWATCHES[1]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);

  const [guessInput, setGuessInput] = useState('');
  const [guessFeed, setGuessFeed] = useState<Array<{ id: string; text: string; tone: 'miss' | 'close' | 'exact' }>>([]);
  const [roundSolved, setRoundSolved] = useState(false);
  const [finished, setFinished] = useState(false);

  const currentPrompt = useMemo(
    () => DRAWING_PROMPTS[roundIdx % DRAWING_PROMPTS.length],
    [roundIdx],
  );

  // Sync multiplayer strokes when available
  const mpStrokes = (session.state as { strokes?: DrawStroke[] }).strokes;
  const activeStrokes = isMultiplayer && modeTab === 'guess' && Array.isArray(mpStrokes)
    ? mpStrokes
    : modeTab === 'draw'
      ? strokes
      : botProgressStrokes;

  // Render canvas whenever strokes change or container resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(280, Math.round(rect.width));
      const h = Math.max(220, Math.round(rect.height));
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0D1224';
      ctx.fillRect(0, 0, w, h);

      // Subtle drawing grid dots
      ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
      for (let gx = 20; gx < w; gx += 28) {
        for (let gy = 20; gy < h; gy += 28) {
          ctx.fillRect(gx, gy, 1.5, 1.5);
        }
      }

      const drawSingle = (st: DrawStroke) => {
        if (st.points.length < 2) return;
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = st.eraser ? '#0D1224' : st.color;
        ctx.lineWidth = st.size;
        ctx.moveTo(st.points[0].x * w, st.points[0].y * h);
        for (let i = 1; i < st.points.length; i += 1) {
          ctx.lineTo(st.points[i].x * w, st.points[i].y * h);
        }
        ctx.stroke();
      };

      activeStrokes.forEach(drawSingle);
      if (currentStrokeRef.current) drawSingle(currentStrokeRef.current);
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [activeStrokes]);

  // Progressive Bot Sketching in Practice Guess Mode
  useEffect(() => {
    if (isMultiplayer || modeTab !== 'guess' || roundSolved || finished) return;
    setBotProgressStrokes([]);
    let step = 0;
    const blueprint = currentPrompt.strokes;
    const timer = window.setInterval(() => {
      step += 1;
      const revealed: DrawStroke[] = blueprint.slice(0, step).map((s, idx) => ({
        id: `bot_${roundIdx}_${idx}`,
        color: s.color,
        size: s.size,
        points: s.points,
      }));
      setBotProgressStrokes(revealed);
      if (step >= blueprint.length) {
        window.clearInterval(timer);
      }
    }, 1150);
    return () => window.clearInterval(timer);
  }, [isMultiplayer, modeTab, roundIdx, currentPrompt, roundSolved, finished]);

  // Round countdown timer
  useEffect(() => {
    if (finished || roundSolved) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          proceedNextRound(score);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finished, roundSolved, roundIdx, score]);

  const proceedNextRound = (latestScore: number) => {
    if (roundIdx + 1 >= TOTAL_ROUNDS) {
      setFinished(true);
      const won = latestScore >= 240;
      if (won) arenaSound.victory();
      else arenaSound.defeat();
      onFinish({
        outcome: won ? 'win' : 'draw',
        score: latestScore,
        opponentName: isMultiplayer ? 'Room Artists' : 'Sketch Arena Bot',
        summary: `Completed ${TOTAL_ROUNDS} rounds · Total Score ${latestScore}`,
        winnerUid: won ? player.uid : null,
      });
      return;
    }
    setRoundIdx((r) => r + 1);
    setSecondsLeft(ROUND_SECONDS);
    setStrokes([]);
    setBotProgressStrokes([]);
    setGuessFeed([]);
    setRoundSolved(false);
    setModeTab((prev) => (prev === 'guess' ? 'draw' : 'guess'));
  };

  // Pointer drawing handlers (touch + mouse)
  const getNormPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height))),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (modeTab !== 'draw' || finished) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const pt = getNormPoint(e);
    currentStrokeRef.current = {
      id: `st_${Date.now()}`,
      color: brushColor,
      size: isEraser ? brushSize * 2.2 : brushSize,
      eraser: isEraser,
      points: [pt, { x: pt.x + 0.001, y: pt.y + 0.001 }],
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    const pt = getNormPoint(e);
    currentStrokeRef.current.points.push(pt);

    // Draw live incrementally on canvas without waiting for React state commit
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      const rect = canvas.getBoundingClientRect();
      const pts = currentStrokeRef.current.points;
      const prev = pts[pts.length - 2];
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = currentStrokeRef.current.eraser ? '#0D1224' : currentStrokeRef.current.color;
      ctx.lineWidth = currentStrokeRef.current.size;
      ctx.moveTo(prev.x * rect.width, prev.y * rect.height);
      ctx.lineTo(pt.x * rect.width, pt.y * rect.height);
      ctx.stroke();
    }
  };

  const finishStroke = () => {
    if (!drawingRef.current || !currentStrokeRef.current) return;
    drawingRef.current = false;
    const finalized = currentStrokeRef.current;
    currentStrokeRef.current = null;
    const next = [...strokes, finalized];
    setStrokes(next);
    if (isMultiplayer) {
      onUpdateSession({ 'state/strokes': next.slice(-60) }).catch(() => {});
    }
  };

  const handleUndo = () => {
    const next = strokes.slice(0, -1);
    setStrokes(next);
    if (isMultiplayer) onUpdateSession({ 'state/strokes': next }).catch(() => {});
  };

  const handleClear = () => {
    setStrokes([]);
    if (isMultiplayer) onUpdateSession({ 'state/strokes': [] }).catch(() => {});
  };

  const handleFinishDrawingRound = () => {
    const pts = Math.min(220, 80 + strokes.length * 25);
    const nextScore = score + pts;
    setScore(nextScore);
    arenaSound.correct();
    setRoundSolved(true);
    window.setTimeout(() => proceedNextRound(nextScore), 700);
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim() || roundSolved || finished) return;
    const verdict = checkDrawingGuess(guessInput, currentPrompt.word);
    setGuessFeed((prev) => [
      { id: `${Date.now()}`, text: guessInput.trim(), tone: verdict },
      ...prev.slice(0, 8),
    ]);
    setGuessInput('');

    if (verdict === 'exact') {
      const gained = scoreDrawingGuess(secondsLeft, ROUND_SECONDS);
      const nextScore = score + gained;
      setScore(nextScore);
      setRoundSolved(true);
      arenaSound.correct();
      if (isMultiplayer) {
        onUpdateSession({ [`players/${player.uid}/score`]: nextScore }).catch(() => {});
      }
      window.setTimeout(() => proceedNextRound(nextScore), 900);
    } else {
      arenaSound.wrong();
    }
  };

  const maskedWord = currentPrompt.word
    .split('')
    .map((ch, i) => (roundSolved || modeTab === 'draw' || i === 0 ? ch : '_'))
    .join(' ');

  return (
    <div className="max-w-4xl mx-auto w-full space-y-4">
      {/* Top Sketch HUD */}
      <div className="arena-surface rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted">
            Round {roundIdx + 1}/{TOTAL_ROUNDS} · {currentPrompt.category}
          </p>
          <p className="font-mono text-base sm:text-lg font-bold tracking-widest text-ink">
            {modeTab === 'draw' ? `Draw: ${currentPrompt.word}` : maskedWord}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isMultiplayer && (
            <div className="inline-flex p-1 rounded-xl bg-panel border border-line">
              <button
                type="button"
                onClick={() => setModeTab('guess')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  modeTab === 'guess' ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
                }`}
              >
                Guess Bot
              </button>
              <button
                type="button"
                onClick={() => setModeTab('draw')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  modeTab === 'draw' ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
                }`}
              >
                Draw Prompt
              </button>
            </div>
          )}

          <div className="text-right">
            <p className="text-[11px] text-muted">Score · Clock</p>
            <p className="font-mono text-sm font-bold text-[#22D3EE] tabular-nums">
              {score} pts · {secondsLeft}s
            </p>
          </div>
        </div>
      </div>

      {/* Main Split: Canvas + Tools / Guess Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2 arena-surface rounded-2xl p-3 flex flex-col gap-3">
          <div className="relative w-full h-[300px] sm:h-[360px] rounded-xl overflow-hidden border border-line touch-none">
            <canvas
              ref={canvasRef}
              data-testid="can-you-guess-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              className={`w-full h-full block ${modeTab === 'draw' ? 'cursor-crosshair' : 'cursor-default'}`}
            />
            {roundSolved && (
              <div className="absolute inset-0 bg-[#080A12]/75 flex flex-col items-center justify-center text-center p-4">
                <p className="font-display text-2xl font-extrabold text-[#22C55E]">
                  {modeTab === 'draw' ? 'Sketch Submitted!' : `Exact Match: ${currentPrompt.word}`}
                </p>
                <p className="text-xs text-slate-300 mt-1">Preparing next round...</p>
              </div>
            )}
          </div>

          {/* Drawing Toolbar */}
          {modeTab === 'draw' ? (
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <div className="flex items-center gap-1.5">
                {SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Select color ${hex}`}
                    onClick={() => {
                      setBrushColor(hex);
                      setIsEraser(false);
                    }}
                    className={`w-7 h-7 rounded-lg border-2 transition-transform ${
                      !isEraser && brushColor === hex ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {BRUSH_SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    aria-label={`Brush size ${sz}`}
                    onClick={() => {
                      setBrushSize(sz);
                      setIsEraser(false);
                    }}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                      !isEraser && brushSize === sz
                        ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-ink'
                        : 'border-line bg-panel text-muted'
                    }`}
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsEraser((e) => !e)}
                  aria-label="Toggle eraser"
                  className={`h-8 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 ${
                    isEraser ? 'border-[#22D3EE] bg-[#22D3EE]/15 text-ink' : 'border-line bg-panel text-muted'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleUndo}
                  aria-label="Undo last stroke"
                  className="h-8 px-2.5 rounded-lg border border-line bg-panel text-muted hover:text-ink"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear canvas"
                  className="h-8 px-2.5 rounded-lg border border-line bg-panel text-muted hover:text-[#EF4444]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleFinishDrawingRound}
                  disabled={strokes.length === 0 || roundSolved}
                  className="arena-gradient-btn h-8 px-3 rounded-lg text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                >
                  Submit Sketch
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted px-1">
              Hint: <span className="text-ink font-medium">{currentPrompt.hint}</span> ({currentPrompt.word.length}{' '}
              letters)
            </p>
          )}
        </div>

        {/* Live Guess Box */}
        <div className="arena-surface rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div>
            <h4 className="font-display text-sm font-bold text-ink mb-2">
              {modeTab === 'draw' ? 'Prompt Details' : 'Live Guess Stream'}
            </h4>
            {modeTab === 'draw' ? (
              <div className="space-y-2 text-xs text-muted">
                <p>
                  Draw <span className="font-mono font-bold text-[#22D3EE]">{currentPrompt.word}</span> clearly without
                  writing letters.
                </p>
                <p>Strokes logged: {strokes.length}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {guessFeed.length === 0 ? (
                  <p className="text-xs text-muted">Watch the sketch unfold and submit your guess below.</p>
                ) : (
                  guessFeed.map((g) => (
                    <div
                      key={g.id}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border ${
                        g.tone === 'exact'
                          ? 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]'
                          : g.tone === 'close'
                            ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                            : 'bg-panel border-line text-muted'
                      }`}
                    >
                      <span>{g.text}</span>
                      <span className="float-right uppercase text-[10px] font-mono">
                        {g.tone === 'exact' ? 'Correct' : g.tone === 'close' ? 'Close!' : 'Miss'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {modeTab === 'guess' && (
            <form onSubmit={handleGuessSubmit} className="flex items-center gap-2 pt-2 border-t border-line">
              <input
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                disabled={roundSolved || finished}
                placeholder="Type your guess..."
                aria-label="Guess the secret drawing"
                className="flex-1 h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
              />
              <button
                type="submit"
                disabled={roundSolved || finished}
                aria-label="Submit drawing guess"
                className="arena-gradient-btn h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
