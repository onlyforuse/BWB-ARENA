import { useEffect, useState } from 'react';
import { Crown, Medal, Trophy } from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import type { GameId, LeaderboardEntry } from '../../types/arena';
import { Avatar } from '../common/Avatar';
import { TableRowsSkeleton } from '../common/Skeletons';
import { calculateWinRate } from '../../lib/gameRules';

type ScopeTab = 'global' | 'weekly' | 'monthly' | GameId;

export function LeaderboardView() {
  const { player, games, loadLeaderboard, setActiveNav } = useArena();
  const [scope, setScope] = useState<ScopeTab>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = loadLeaderboard(scope, (data) => {
      setEntries(data);
      setLoading(false);
    });
    return () => unsub();
  }, [scope, loadLeaderboard]);

  if (!player) return null;

  const enabledGames = games.filter((g) => g.enabled);
  const topThree = entries.slice(0, 3);
  const myRankIndex = entries.findIndex((e) => e.uid === player.uid);

  const podiumStyles = [
    { rank: '#1', border: 'border-amber-400/50', accent: 'text-amber-400', icon: Crown, label: 'Champion' },
    { rank: '#2', border: 'border-slate-300/40', accent: 'text-slate-200', icon: Medal, label: 'Runner-Up' },
    { rank: '#3', border: 'border-orange-400/45', accent: 'text-orange-400', icon: Medal, label: 'Third Place' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Current Player Rank */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Competitive Leaderboards</h2>
          <p className="text-sm text-muted mt-0.5">
            Only verified competitive match results count toward seasonal and game-specific rankings.
          </p>
        </div>

        <div className="arena-surface rounded-xl px-4 py-2.5 text-xs font-mono tabular-nums shrink-0">
          Your Standing:{' '}
          <span className="font-bold text-[#22D3EE]">
            {myRankIndex >= 0 ? `#${myRankIndex + 1}` : 'Unranked'}
          </span>
        </div>
      </div>

      {/* Period & Game-Specific Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { id: 'global', label: 'Global' },
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            ...enabledGames.map((g) => ({ id: g.id as ScopeTab, label: g.shortTitle })),
          ] as Array<{ id: ScopeTab; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setScope(tab.id)}
            className={`h-9 px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              scope === tab.id
                ? 'bg-[#8B5CF6] text-white'
                : 'bg-surface border border-line text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Top 3 Championship Podium */}
      {!loading && topThree.length > 0 && (
        <section aria-label="Top three players" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topThree.map((entry, idx) => {
            const st = podiumStyles[idx];
            const Icon = st.icon;
            return (
              <article
                key={entry.uid}
                className={`arena-surface rounded-2xl p-5 border ${st.border} flex flex-col justify-between gap-4`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-sm font-bold inline-flex items-center gap-1.5 ${st.accent}`}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {st.rank} · {st.label}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-muted tabular-nums">Lvl {entry.level}</span>
                </div>

                <div className="flex items-center gap-3.5">
                  <Avatar
                    avatarId={entry.avatarId}
                    avatarUrl={entry.avatarUrl}
                    name={entry.displayName}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-ink truncate">{entry.displayName}</p>
                    <p className="text-xs text-muted truncate">@{entry.username}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-line text-center font-mono tabular-nums">
                  <div>
                    <p className="text-[10px] text-muted">Score</p>
                    <p className="text-sm font-bold text-[#22D3EE]">{entry.score.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">Wins</p>
                    <p className="text-sm font-bold text-[#22C55E]">{entry.wins}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted">XP</p>
                    <p className="text-sm font-bold text-ink">{entry.xp.toLocaleString()}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Full Rankings Table */}
      <section className="arena-surface rounded-2xl overflow-hidden">
        {loading ? (
          <TableRowsSkeleton rows={5} />
        ) : entries.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Trophy className="w-8 h-8 mx-auto text-[#8B5CF6]" aria-hidden="true" />
            <div>
              <p className="font-display text-lg font-bold text-ink">No Ranked Matches Recorded Yet</p>
              <p className="text-sm text-muted mt-1 max-w-md mx-auto">
                Complete matches in any arena title to generate verified score entries on this leaderboard.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveNav('games')}
              className="arena-gradient-btn h-10 px-5 rounded-xl text-xs font-semibold"
            >
              Play a Match
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-panel/60 text-[11px] font-mono uppercase tracking-wider text-muted">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4 text-right">Wins</th>
                  <th className="py-3 px-4 text-right hidden sm:table-cell">Win Rate</th>
                  <th className="py-3 px-4 text-right">XP</th>
                  <th className="py-3 px-4 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {entries.map((row, idx) => {
                  const isMe = row.uid === player.uid;
                  return (
                    <tr
                      key={row.uid}
                      className={isMe ? 'bg-[#8B5CF6]/12' : 'hover:bg-white/[0.02] transition-colors'}
                    >
                      <td className="py-3 px-4 font-mono font-bold tabular-nums text-ink">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            avatarId={row.avatarId}
                            avatarUrl={row.avatarUrl}
                            name={row.displayName}
                            size="xs"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate">
                              {row.displayName}
                              {isMe && <span className="text-[#22D3EE] text-xs font-normal ml-1.5">(You)</span>}
                            </p>
                            <p className="text-xs text-muted truncate">
                              @{row.username} · Lvl {row.level}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#22C55E] font-semibold">
                        {row.wins}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-muted hidden sm:table-cell">
                        {calculateWinRate(row.wins, row.gamesPlayed)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-ink">
                        {row.xp.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#22D3EE]">
                        {row.score.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
