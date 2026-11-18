import React, { useMemo, useState } from 'react';
import { Calendar, Plus, Trash2, Trophy, Users } from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import { validateTournamentDraft } from '../../../lib/adminRules';
import type { GameId } from '../../../types/arena';

function defaultStartLocalValue(): string {
  const d = new Date(Date.now() + 24 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

export function AdminTournamentsView() {
  const { tournaments, games, saveTournament, deleteTournament } = useAdmin();

  const [title, setTitle] = useState('');
  const [gameId, setGameId] = useState<GameId>('quiz-battle');
  const [format, setFormat] = useState('Best of 3 · Elimination');
  const [prizeCoins, setPrizeCoins] = useState('2500');
  const [prizeXp, setPrizeXp] = useState('1200');
  const [maxSlots, setMaxSlots] = useState('32');
  const [startsAtInput, setStartsAtInput] = useState(defaultStartLocalValue);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const gameTitleMap = useMemo(
    () => Object.fromEntries(games.map((g) => [g.id, g.title])),
    [games],
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const parsedTime = new Date(startsAtInput).getTime();
    const draft = {
      title,
      format,
      prizeCoins: Number(prizeCoins),
      prizeXp: Number(prizeXp),
      maxSlots: Number(maxSlots),
      startsAt: parsedTime,
    };
    const check = validateTournamentDraft(draft);
    if (!check.valid) {
      setError(check.error || 'Verify all tournament fields.');
      return;
    }

    setBusy(true);
    try {
      await saveTournament({
        title: title.trim(),
        gameId,
        format: format.trim(),
        prizeCoins: draft.prizeCoins,
        prizeXp: draft.prizeXp,
        maxSlots: draft.maxSlots,
        startsAt: parsedTime,
      });
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">Tournament & Bracket Operations</h2>
        <p className="text-xs text-muted mt-0.5">
          Schedule official BWB ARENA events, set prize pools, and monitor player bracket registrations live.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Create Tournament Form */}
        <form onSubmit={handleCreate} className="lg:col-span-5 arena-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#8B5CF6]" />
            <h3 className="font-display text-base font-bold text-ink">Schedule New Tournament</h3>
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="t-title" className="block text-xs text-muted">
              Tournament Title
            </label>
            <input
              id="t-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Friday Night Arena Blitz"
              className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="t-game" className="block text-xs text-muted">
                Game Title
              </label>
              <select
                id="t-game"
                value={gameId}
                onChange={(e) => setGameId(e.target.value as GameId)}
                className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-xs text-ink focus:outline-none focus:border-[#8B5CF6]"
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="t-slots" className="block text-xs text-muted">
                Max Slots
              </label>
              <input
                id="t-slots"
                type="number"
                min={4}
                max={512}
                value={maxSlots}
                onChange={(e) => setMaxSlots(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm font-mono text-ink tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="t-coins" className="block text-xs text-muted">
                Prize Pool (Coins)
              </label>
              <input
                id="t-coins"
                type="number"
                min={0}
                value={prizeCoins}
                onChange={(e) => setPrizeCoins(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm font-mono text-ink tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="t-xp" className="block text-xs text-muted">
                Bonus XP
              </label>
              <input
                id="t-xp"
                type="number"
                min={0}
                value={prizeXp}
                onChange={(e) => setPrizeXp(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm font-mono text-ink tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="t-format" className="block text-xs text-muted">
              Format Summary
            </label>
            <input
              id="t-format"
              type="text"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="t-starts" className="block text-xs text-muted">
              Start Date & Time
            </label>
            <input
              id="t-starts"
              type="datetime-local"
              value={startsAtInput}
              onChange={(e) => setStartsAtInput(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-xs font-mono text-ink focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full h-10 rounded-xl arena-gradient-btn text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Create Tournament</span>
          </button>
        </form>

        {/* Scheduled Tournaments List */}
        <section className="lg:col-span-7 arena-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-ink">
              Scheduled Events ({tournaments.length})
            </h3>
          </div>

          {tournaments.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">No tournaments scheduled yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {tournaments.map((t) => {
                const regCount = Object.keys(t.registeredUids || {}).length;
                return (
                  <article key={t.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-mono text-[#22D3EE]">
                        {gameTitleMap[t.gameId] || t.gameId} · {t.format}
                      </p>
                      <h4 className="font-display text-base font-bold text-ink truncate">{t.title}</h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-mono tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(t.startsAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1 text-ink">
                          <Users className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          {regCount}/{t.maxSlots} slots
                        </span>
                        <span className="text-amber-400">{t.prizeCoins.toLocaleString()} Coins</span>
                        <span>+{t.prizeXp} XP</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void deleteTournament(t)}
                      aria-label={`Delete tournament ${t.title}`}
                      className="h-9 px-3 rounded-xl border border-red-500/30 text-xs font-semibold text-red-300 hover:bg-red-500/15 inline-flex items-center gap-1.5 self-start sm:self-center shrink-0 whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
