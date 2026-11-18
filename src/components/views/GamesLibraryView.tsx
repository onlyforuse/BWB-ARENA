import { useEffect, useState } from 'react';
import { BookOpen, Play, Search, Swords, Trophy, X } from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import type { ArenaGameDefinition, LeaderboardEntry } from '../../types/arena';
import { GameArtwork } from '../common/GameArtwork';
import { Avatar } from '../common/Avatar';
import { calculateWinRate } from '../../lib/gameRules';

const CATEGORIES = ['All', 'Creative', 'Trivia', 'Strategy', 'Arcade', 'Word'] as const;

export function GamesLibraryView() {
  const {
    player,
    games,
    launchPracticeGame,
    createRoom,
    setActiveNav,
    loadLeaderboard,
    pushToast,
  } = useArena();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [selectedGame, setSelectedGame] = useState<ArenaGameDefinition | null>(null);
  const [modalTab, setModalTab] = useState<'instructions' | 'leaderboard' | 'stats'>('instructions');
  const [gameLeaderboard, setGameLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (!selectedGame) return;
    return loadLeaderboard(selectedGame.id, setGameLeaderboard);
  }, [selectedGame, loadLeaderboard]);

  if (!player) return null;

  // Never show disabled games as playable
  const enabledGames = games.filter((g) => g.enabled);
  const filtered = enabledGames.filter((g) => {
    const matchCat = category === 'All' || g.category === category;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || g.title.toLowerCase().includes(q) || g.description.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const handleQuickCreateRoom = async (game: ArenaGameDefinition) => {
    try {
      await createRoom({
        gameId: game.id,
        name: `${player.displayName}'s ${game.shortTitle}`,
        isPrivate: false,
        maxPlayers: Math.min(game.maxPlayers, 4),
      });
      setSelectedGame(null);
      setActiveNav('multiplayer');
    } catch (err) {
      pushToast({
        tone: 'danger',
        title: 'Room Creation Failed',
        message: err instanceof Error ? err.message : 'Unable to create room.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Discover Playable Games</h2>
          <p className="text-sm text-muted mt-0.5">
            {enabledGames.length} live competitive arenas synchronized with BWB ARENA
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search games..."
            aria-label="Search playable games"
            className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-surface border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>
      </div>

      {/* Category Filter Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              category === cat
                ? 'bg-[#8B5CF6] text-white'
                : 'bg-surface border border-line text-muted hover:text-ink'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Games Grid */}
      {filtered.length === 0 ? (
        <div className="arena-surface rounded-2xl p-10 text-center space-y-2">
          <p className="font-display text-lg font-bold text-ink">No matching games found</p>
          <p className="text-sm text-muted">Try clearing your search or selecting another category.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategory('All');
            }}
            className="mt-2 h-9 px-4 rounded-xl bg-panel border border-line text-xs font-semibold text-[#22D3EE]"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((game) => {
            const pStats = player.gameStats[game.id];
            return (
              <article
                key={game.id}
                className="arena-surface rounded-2xl overflow-hidden flex flex-col hover:border-[#8B5CF6]/50 transition-colors"
              >
                <div className="relative aspect-[4/3] bg-panel overflow-hidden">
                  <GameArtwork
                    src={game.thumbnail}
                    alt={`${game.title} cover art`}
                    title={game.title}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080A12]/80 via-transparent to-transparent" />
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-xs text-muted tabular-nums mb-1.5">
                    <span className="text-[#22D3EE] font-semibold">{game.statusLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{game.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {game.minPlayers}–{game.maxPlayers} Players
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-bold text-ink">{game.title}</h3>
                  <p className="text-sm text-muted mt-1.5 leading-relaxed flex-1">{game.description}</p>

                  <div className="mt-4 pt-3.5 border-t border-line space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted font-mono tabular-nums">
                      <span>Win: +{game.xpRewardWin} XP · +{game.coinRewardWin} Coins</span>
                      <span>{pStats ? `${pStats.wins}W / ${pStats.played}G` : game.avgDuration}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => launchPracticeGame(game.id)}
                        className="flex-1 h-10 arena-gradient-btn rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Play Solo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickCreateRoom(game)}
                        className="h-10 px-3.5 rounded-xl bg-panel border border-line text-xs font-semibold text-ink hover:border-[#22D3EE]/50 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Swords className="w-3.5 h-3.5 text-[#22D3EE]" />
                        <span>Host Room</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGame(game);
                          setModalTab('instructions');
                        }}
                        aria-label={`View instructions and leaderboard for ${game.title}`}
                        className="h-10 w-10 rounded-xl bg-panel border border-line flex items-center justify-center text-muted hover:text-ink shrink-0"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Game Details Modal (Instructions, Game-Specific Leaderboard & Personal Statistics) */}
      {selectedGame && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-detail-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="arena-surface rounded-2xl w-full max-w-xl overflow-hidden my-auto shadow-2xl">
            <div className="relative h-44 bg-panel">
              <GameArtwork src={selectedGame.thumbnail} alt={selectedGame.title} title={selectedGame.title} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#151B30] via-[#151B30]/40 to-transparent" />
              <button
                type="button"
                onClick={() => setSelectedGame(null)}
                aria-label="Close game details"
                className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-[#080A12]/70 text-white flex items-center justify-center hover:bg-[#080A12]"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 left-5 right-5">
                <p className="text-xs font-mono text-[#22D3EE]">
                  {selectedGame.category} · {selectedGame.minPlayers}–{selectedGame.maxPlayers} Players ·{' '}
                  {selectedGame.avgDuration}
                </p>
                <h3 id="game-detail-title" className="font-display text-2xl font-extrabold text-white">
                  {selectedGame.title}
                </h3>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-panel border border-line">
                {(['instructions', 'leaderboard', 'stats'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setModalTab(tab)}
                    className={`py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      modalTab === tab ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {modalTab === 'instructions' && (
                <ol className="space-y-2.5 text-sm text-muted">
                  {selectedGame.instructions.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="font-mono text-xs font-bold text-[#22D3EE] mt-0.5 tabular-nums">
                        0{i + 1}.
                      </span>
                      <span className="leading-relaxed text-ink/90">{step}</span>
                    </li>
                  ))}
                </ol>
              )}

              {modalTab === 'leaderboard' && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {gameLeaderboard.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted">
                      <Trophy className="w-6 h-6 mx-auto text-muted/60 mb-2" />
                      No verified leaderboard entries for {selectedGame.title} yet. Play a match to claim #1.
                    </div>
                  ) : (
                    gameLeaderboard.slice(0, 8).map((entry, idx) => (
                      <div
                        key={entry.uid}
                        className="flex items-center justify-between py-2 px-3 rounded-xl bg-panel border border-line"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-xs font-bold text-[#22D3EE] w-5 tabular-nums">
                            #{idx + 1}
                          </span>
                          <Avatar avatarId={entry.avatarId} avatarUrl={entry.avatarUrl} name={entry.displayName} size="xs" />
                          <span className="text-sm font-medium text-ink truncate">@{entry.username}</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-ink tabular-nums">
                          {entry.score} pts · {entry.wins}W
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {modalTab === 'stats' && (() => {
                const st = player.gameStats[selectedGame.id] || {
                  played: 0,
                  wins: 0,
                  losses: 0,
                  draws: 0,
                  bestScore: 0,
                };
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-panel border border-line p-3">
                      <p className="text-[11px] text-muted">Played</p>
                      <p className="font-mono text-xl font-bold text-ink tabular-nums mt-0.5">{st.played}</p>
                    </div>
                    <div className="rounded-xl bg-panel border border-line p-3">
                      <p className="text-[11px] text-muted">Wins</p>
                      <p className="font-mono text-xl font-bold text-[#22C55E] tabular-nums mt-0.5">{st.wins}</p>
                    </div>
                    <div className="rounded-xl bg-panel border border-line p-3">
                      <p className="text-[11px] text-muted">Win Rate</p>
                      <p className="font-mono text-xl font-bold text-[#22D3EE] tabular-nums mt-0.5">
                        {calculateWinRate(st.wins, st.played)}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-panel border border-line p-3">
                      <p className="text-[11px] text-muted">Best Score</p>
                      <p className="font-mono text-xl font-bold text-[#8B5CF6] tabular-nums mt-0.5">{st.bestScore}</p>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center gap-2.5 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedGame.id;
                    setSelectedGame(null);
                    launchPracticeGame(id);
                  }}
                  className="flex-1 h-11 arena-gradient-btn rounded-xl text-sm font-semibold"
                >
                  Play Solo Practice
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCreateRoom(selectedGame)}
                  className="flex-1 h-11 rounded-xl bg-panel border border-line text-sm font-semibold text-ink hover:border-[#22D3EE]/50"
                >
                  Create Multiplayer Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
