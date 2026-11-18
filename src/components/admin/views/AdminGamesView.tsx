import { useState } from 'react';
import { Check, Pencil, Power, Save, Star, TrendingUp, X } from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import { GameArtwork } from '../../common/GameArtwork';
import type { ArenaGameDefinition } from '../../../types/arena';

export function AdminGamesView() {
  const { games, analytics, saveGameConfig } = useAdmin();
  const [editing, setEditing] = useState<ArenaGameDefinition | null>(null);
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const openEditor = (game: ArenaGameDefinition) => {
    setEditing({ ...game });
    setInstructionsDraft(game.instructions.join('\n'));
    setError('');
  };

  const handleQuickToggle = async (
    game: ArenaGameDefinition,
    field: 'enabled' | 'featured' | 'trending',
  ) => {
    setBusyId(game.id);
    try {
      const nextVal = !game[field];
      const updated: ArenaGameDefinition = {
        ...game,
        [field]: nextVal,
        statusLabel:
          field === 'enabled'
            ? nextVal
              ? game.featured
                ? 'Featured'
                : 'Live'
              : 'Maintenance'
            : field === 'featured' && game.enabled
              ? nextVal
                ? 'Featured'
                : 'Live'
              : game.statusLabel,
      };
      await saveGameConfig(updated);
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError('');
    if (editing.title.trim().length < 2) {
      setError('Game title is required.');
      return;
    }
    if (editing.maxPlayers < editing.minPlayers || editing.maxPlayers > 8) {
      setError('Max players must be between minPlayers and 8.');
      return;
    }
    if (editing.xpRewardWin < 0 || editing.coinRewardWin < 0) {
      setError('XP and Coin rewards cannot be negative.');
      return;
    }
    const parsedInstructions = instructionsDraft
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (parsedInstructions.length === 0) {
      setError('Provide at least one instruction line for players.');
      return;
    }

    setBusyId(editing.id);
    try {
      await saveGameConfig({
        ...editing,
        title: editing.title.trim(),
        description: editing.description.trim(),
        instructions: parsedInstructions,
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save game settings.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Game Catalog & Reward Controls</h2>
          <p className="text-xs text-muted mt-0.5">
            Enable/disable arenas, highlight featured titles, adjust lobby limits, and tune win payouts live.
          </p>
        </div>
        <p className="text-xs font-mono text-muted tabular-nums">
          {games.filter((g) => g.enabled).length} / {games.length} active
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {games.map((game) => {
          const stats = analytics.gameBreakdown.find((b) => b.gameId === game.id);
          const isBusy = busyId === game.id;
          return (
            <article key={game.id} className="arena-surface rounded-2xl overflow-hidden flex flex-col">
              <div className="relative h-36 bg-panel overflow-hidden">
                <GameArtwork
                  src={game.thumbnail}
                  title={game.title}
                  alt={`${game.title} arena thumbnail`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080A12] via-[#080A12]/40 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-[#22D3EE]">
                      {game.category} · {game.minPlayers}–{game.maxPlayers} Players
                    </p>
                    <h3 className="font-display text-lg font-bold text-white truncate">{game.title}</h3>
                  </div>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ${
                      game.enabled ? 'text-[#22C55E]' : 'text-amber-400'
                    }`}
                  >
                    {game.enabled ? game.statusLabel : 'Disabled'}
                  </span>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <p className="text-xs text-muted line-clamp-2 leading-relaxed">{game.description}</p>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-line text-xs font-mono tabular-nums">
                    <div>
                      <span className="block text-[11px] font-sans text-muted">Win XP</span>
                      <span className="text-ink font-semibold">+{game.xpRewardWin}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] font-sans text-muted">Win Coins</span>
                      <span className="text-amber-400 font-semibold">+{game.coinRewardWin}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] font-sans text-muted">Matches</span>
                      <span className="text-ink font-semibold">{stats?.matchesPlayed ?? 0}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-line">
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleQuickToggle(game, 'enabled')}
                      aria-label={`Toggle enabled for ${game.title}`}
                      className={`h-9 rounded-lg border text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors ${
                        game.enabled
                          ? 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]'
                          : 'bg-panel border-line text-muted'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{game.enabled ? 'Live' : 'Off'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleQuickToggle(game, 'featured')}
                      aria-label={`Toggle featured for ${game.title}`}
                      className={`h-9 rounded-lg border text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors ${
                        game.featured
                          ? 'bg-[#8B5CF6]/18 border-[#8B5CF6]/45 text-[#a78bfa]'
                          : 'bg-panel border-line text-muted'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span>Featured</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleQuickToggle(game, 'trending')}
                      aria-label={`Toggle trending for ${game.title}`}
                      className={`h-9 rounded-lg border text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors ${
                        game.trending
                          ? 'bg-[#22D3EE]/15 border-[#22D3EE]/40 text-[#22D3EE]'
                          : 'bg-panel border-line text-muted'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Trend</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEditor(game)}
                    className="w-full h-9 rounded-xl bg-surface-elevated border border-line hover:border-[#8B5CF6]/50 text-xs font-semibold text-ink inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#22D3EE]" />
                    <span>Edit Rules & Rewards</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Edit Game Modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${editing.title} configuration`}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <form
            onSubmit={handleSaveModal}
            className="arena-surface rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Configure {editing.title}</h3>
                <p className="text-xs font-mono text-muted">ID: {editing.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close game editor"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs text-red-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="game-title" className="block text-xs text-muted">
                  Display Title
                </label>
                <input
                  id="game-title"
                  type="text"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="game-status-label" className="block text-xs text-muted">
                  Status Label
                </label>
                <select
                  id="game-status-label"
                  value={editing.statusLabel}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      statusLabel: e.target.value as ArenaGameDefinition['statusLabel'],
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
                >
                  <option value="Live">Live</option>
                  <option value="Featured">Featured</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="game-max-players" className="block text-xs text-muted">
                  Max Room Players ({editing.minPlayers}–8)
                </label>
                <input
                  id="game-max-players"
                  type="number"
                  min={editing.minPlayers}
                  max={8}
                  value={editing.maxPlayers}
                  onChange={(e) => setEditing({ ...editing, maxPlayers: Number(e.target.value) })}
                  className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm font-mono text-ink tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="game-duration" className="block text-xs text-muted">
                  Avg Match Duration
                </label>
                <input
                  id="game-duration"
                  type="text"
                  value={editing.avgDuration}
                  onChange={(e) => setEditing({ ...editing, avgDuration: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm text-ink"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="game-win-xp" className="block text-xs text-muted">
                  Win XP Reward
                </label>
                <input
                  id="game-win-xp"
                  type="number"
                  min={0}
                  max={5000}
                  value={editing.xpRewardWin}
                  onChange={(e) => setEditing({ ...editing, xpRewardWin: Number(e.target.value) })}
                  className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm font-mono text-ink tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="game-win-coins" className="block text-xs text-muted">
                  Win Coins Reward
                </label>
                <input
                  id="game-win-coins"
                  type="number"
                  min={0}
                  max={5000}
                  value={editing.coinRewardWin}
                  onChange={(e) => setEditing({ ...editing, coinRewardWin: Number(e.target.value) })}
                  className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm font-mono text-ink tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="game-description" className="block text-xs text-muted">
                Description
              </label>
              <textarea
                id="game-description"
                rows={2}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="w-full p-3 rounded-xl bg-panel border border-line text-xs text-ink focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="game-instructions" className="block text-xs text-muted">
                Player Rules (one bullet per line)
              </label>
              <textarea
                id="game-instructions"
                rows={4}
                value={instructionsDraft}
                onChange={(e) => setInstructionsDraft(e.target.value)}
                className="w-full p-3 rounded-xl bg-panel border border-line text-xs font-mono text-ink focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-10 px-4 rounded-xl border border-line text-xs font-medium text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === editing.id}
                className="h-10 px-5 rounded-xl arena-gradient-btn text-xs font-semibold inline-flex items-center gap-1.5"
              >
                {busyId === editing.id ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Game Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
