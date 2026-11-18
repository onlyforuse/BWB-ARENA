import {
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  Coins,
  Flame,
  Gamepad2,
  Megaphone,
  Play,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import { DAILY_CHALLENGES } from '../../data/catalog';
import { calculateLevelFromXp, calculateWinRate } from '../../lib/gameRules';
import { Avatar } from '../common/Avatar';
import { GameArtwork } from '../common/GameArtwork';

export function HomeDashboardView() {
  const {
    player,
    games,
    announcements,
    tournaments,
    onlinePlayersCount,
    claimedChallenges,
    setActiveNav,
    launchPracticeGame,
    toggleTournament,
    claimDailyChallenge,
  } = useArena();

  if (!player) return null;

  const enabledGames = games.filter((g) => g.enabled);
  const featuredGames = enabledGames.filter((g) => g.featured);
  const trendingGames = enabledGames.filter((g) => g.trending);
  const levelInfo = calculateLevelFromXp(player.xp);
  const winRate = calculateWinRate(player.wins, player.gamesPlayed);

  const recentlyPlayedIds = Array.from(new Set(player.recentMatches.map((m) => m.gameId))).slice(0, 3);
  const recentlyPlayedGames = recentlyPlayedIds
    .map((id) => enabledGames.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const recommendedGames = enabledGames.filter((g) => !recentlyPlayedIds.includes(g.id)).slice(0, 3);

  const getChallengeProgress = (metric: (typeof DAILY_CHALLENGES)[number]['metric']): number => {
    switch (metric) {
      case 'games_played':
        return player.gamesPlayed;
      case 'wins':
        return player.wins;
      case 'word_or_quiz':
        return (player.gameStats['quiz-battle']?.played ?? 0) + (player.gameStats['word-battle']?.played ?? 0);
      default:
        return 0;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <section className="arena-surface rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-[#8B5CF6]/15 blur-3xl pointer-events-none"
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <Avatar
              avatarId={player.avatarId}
              avatarUrl={player.avatarUrl}
              name={player.displayName}
              size="lg"
              online={player.online}
              showPresence
            />
            <div className="min-w-0 space-y-1.5">
              <p className="text-xs font-mono text-[#22D3EE] tabular-nums">
                Level {levelInfo.level} · @{player.username} · {onlinePlayersCount} Players Online
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-ink leading-tight">
                Welcome back, {player.displayName}
              </h2>
              <div className="flex items-center gap-3 max-w-md pt-0.5">
                <div className="flex-1 h-2 rounded-full bg-panel overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] transition-all duration-300"
                    style={{ width: `${levelInfo.progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-muted tabular-nums shrink-0">
                  {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveNav('multiplayer')}
              className="arena-gradient-btn h-11 px-5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Swords className="w-4 h-4" />
              <span>Create / Join Room</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveNav('games')}
              className="h-11 px-4 rounded-xl bg-panel border border-line text-sm font-semibold text-ink hover:border-[#8B5CF6]/50 transition-colors whitespace-nowrap"
            >
              Browse Games
            </button>
          </div>
        </div>
      </section>

      {/* Animated Competitive KPI Grid */}
      <section aria-label="Player statistics" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[
          { label: 'Total XP', value: player.xp.toLocaleString(), sub: `Level ${levelInfo.level}`, icon: Award, accent: 'text-[#8B5CF6]' },
          { label: 'Arena Coins', value: player.coins.toLocaleString(), sub: 'Verified Balance', icon: Coins, accent: 'text-amber-400' },
          { label: 'Games Played', value: String(player.gamesPlayed), sub: `${player.currentStreak} Streak`, icon: Gamepad2, accent: 'text-[#3B82F6]' },
          { label: 'Total Wins', value: String(player.wins), sub: `${player.losses} Losses`, icon: Trophy, accent: 'text-[#22C55E]' },
          { label: 'Win Rate', value: `${winRate}%`, sub: 'All Modes', icon: Flame, accent: 'text-[#22D3EE]' },
          { label: 'Online Now', value: String(onlinePlayersCount), sub: 'Live Presence', icon: Users, accent: 'text-[#22C55E]' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="arena-surface rounded-2xl p-4 hover:border-[#8B5CF6]/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted">{stat.label}</span>
                <Icon className={`w-4 h-4 ${stat.accent}`} aria-hidden="true" />
              </div>
              <p className="font-mono text-2xl font-bold text-ink tabular-nums">{stat.value}</p>
              <p className="text-[11px] text-muted mt-1">{stat.sub}</p>
            </div>
          );
        })}
      </section>

      {/* Main Asymmetric Split: Featured & Trending Games + Announcements & Challenges */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Featured, Trending & Recently Played */}
        <div className="xl:col-span-2 space-y-6">
          {/* Featured Games */}
          <section>
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Featured Arenas</h3>
                <p className="text-xs text-muted">Instant play solo or launch a synced multiplayer room</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveNav('games')}
                className="text-xs font-semibold text-[#22D3EE] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>All Games</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredGames.map((game) => (
                <article
                  key={game.id}
                  className="arena-surface rounded-2xl overflow-hidden flex flex-col hover:border-[#8B5CF6]/45 transition-colors"
                >
                  <div className="relative aspect-[4/3] bg-panel overflow-hidden">
                    <GameArtwork
                      src={game.thumbnail}
                      alt={`${game.title} arena thumbnail`}
                      title={game.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#080A12]/80 via-transparent to-transparent" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-[11px] text-muted tabular-nums">
                      {game.category} · {game.minPlayers}–{game.maxPlayers} Players
                    </p>
                    <h4 className="font-display text-base font-bold text-ink mt-0.5">{game.title}</h4>
                    <p className="text-xs text-muted mt-1 line-clamp-2 flex-1">{game.description}</p>
                    <div className="mt-3.5 pt-3 border-t border-line flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => launchPracticeGame(game.id)}
                        className="flex-1 h-9 arena-gradient-btn rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Play Now</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveNav('multiplayer')}
                        className="h-9 px-3 rounded-xl bg-panel border border-line text-xs font-semibold text-ink hover:border-[#22D3EE]/50 whitespace-nowrap"
                      >
                        Room
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Trending & Recommended Strip */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="arena-surface rounded-2xl p-5">
              <h3 className="font-display text-base font-bold text-ink mb-3">Trending Now</h3>
              <div className="divide-y divide-line">
                {trendingGames.slice(0, 4).map((g) => (
                  <div key={g.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-9 rounded-lg overflow-hidden bg-panel shrink-0">
                        <GameArtwork src={g.thumbnail} alt={g.title} title={g.title} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{g.title}</p>
                        <p className="text-[11px] text-muted tabular-nums">
                          {g.category} · +{g.xpRewardWin} XP win
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => launchPracticeGame(g.id)}
                      className="h-8 px-3 rounded-lg bg-panel border border-line text-xs font-semibold text-[#22D3EE] hover:border-[#22D3EE]/50 whitespace-nowrap shrink-0"
                    >
                      Play
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="arena-surface rounded-2xl p-5">
              <h3 className="font-display text-base font-bold text-ink mb-3">
                {recentlyPlayedGames.length > 0 ? 'Recently Played' : 'Recommended For You'}
              </h3>
              <div className="divide-y divide-line">
                {(recentlyPlayedGames.length > 0 ? recentlyPlayedGames : recommendedGames).map((g) => {
                  const st = player.gameStats[g.id];
                  return (
                    <div key={g.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-9 rounded-lg overflow-hidden bg-panel shrink-0">
                          <GameArtwork src={g.thumbnail} alt={g.title} title={g.title} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{g.title}</p>
                          <p className="text-[11px] text-muted tabular-nums">
                            {st ? `${st.played} played · ${st.wins} wins` : `${g.avgDuration} · ${g.category}`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => launchPracticeGame(g.id)}
                        className="h-8 px-3 rounded-lg bg-panel border border-line text-xs font-semibold text-ink hover:border-[#8B5CF6]/50 whitespace-nowrap shrink-0"
                      >
                        Launch
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Upcoming Tournaments */}
          <section className="arena-surface rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base font-bold text-ink">Upcoming Tournaments</h3>
                <p className="text-xs text-muted">Reserve your bracket slot across scheduled events</p>
              </div>
              <Calendar className="w-4 h-4 text-[#22D3EE]" aria-hidden="true" />
            </div>

            <div className="divide-y divide-line">
              {tournaments.map((t) => {
                const isRegistered = Boolean(t.registeredUids[player.uid]);
                const regCount = Object.keys(t.registeredUids).length;
                const gameTitle = games.find((g) => g.id === t.gameId)?.title ?? t.gameId;
                const startText = new Date(t.startsAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={t.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">{t.title}</p>
                      <p className="text-xs text-muted mt-0.5 tabular-nums">
                        {gameTitle} · {t.format} · Starts {startText}
                      </p>
                      <p className="text-xs font-mono text-[#22D3EE] mt-1 tabular-nums">
                        Prize Pool: {t.prizeCoins.toLocaleString()} Coins · {t.prizeXp} XP · {regCount}/{t.maxSlots}{' '}
                        Slots
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTournament(t.id)}
                      className={`h-9 px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                        isRegistered
                          ? 'bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E]'
                          : 'arena-gradient-btn'
                      }`}
                    >
                      {isRegistered ? 'Registered ✓' : 'Join Bracket'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Platform Announcements & Daily Challenges */}
        <div className="space-y-6">
          {/* Platform Announcements */}
          <section className="arena-surface rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="font-display text-base font-bold text-ink">Platform Announcements</h3>
              <Megaphone className="w-4 h-4 text-[#8B5CF6]" aria-hidden="true" />
            </div>
            <div className="space-y-4 divide-y divide-line">
              {announcements.slice(0, 3).map((ann) => (
                <article key={ann.id} className="pt-3.5 first:pt-0">
                  <p className="text-[11px] font-mono text-[#22D3EE] mb-1">
                    {ann.pinned ? 'Pinned Notice' : 'Update'} ·{' '}
                    {new Date(ann.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                  <h4 className="text-sm font-bold text-ink">{ann.title}</h4>
                  <p className="text-xs text-muted mt-1 leading-relaxed">{ann.body}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Daily Challenges */}
          <section className="arena-surface rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className="font-display text-base font-bold text-ink">Daily Challenges</h3>
                <p className="text-xs text-muted">Complete matches to unlock bonus rewards</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveNav('achievements')}
                className="text-xs font-semibold text-[#22D3EE] hover:underline"
              >
                All
              </button>
            </div>

            <div className="space-y-4">
              {DAILY_CHALLENGES.map((ch) => {
                const progress = Math.min(ch.target, getChallengeProgress(ch.metric));
                const pct = Math.round((progress / ch.target) * 100);
                const complete = progress >= ch.target;
                const claimed = Boolean(claimedChallenges[ch.id]);

                return (
                  <div key={ch.id} className="pb-4 border-b border-line last:border-none last:pb-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink">{ch.title}</p>
                        <p className="text-xs text-muted mt-0.5">{ch.description}</p>
                      </div>
                      <span className="font-mono text-xs text-muted tabular-nums shrink-0">
                        {progress}/{ch.target}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-panel overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[11px] font-mono text-muted tabular-nums">
                        +{ch.xpReward} XP · +{ch.coinReward} Coins
                      </span>
                      {claimed ? (
                        <span className="text-xs font-semibold text-[#22C55E] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Claimed
                        </span>
                      ) : complete ? (
                        <button
                          type="button"
                          onClick={() => claimDailyChallenge(ch.id, ch.xpReward, ch.coinReward)}
                          className="text-xs font-semibold text-[#22D3EE] hover:underline"
                        >
                          Claim Reward
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted">In Progress</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
