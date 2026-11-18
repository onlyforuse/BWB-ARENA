import { useEffect, useState } from 'react';
import { Award, RotateCcw, Trash2 } from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import { Avatar } from '../../common/Avatar';
import type { LeaderboardEntry } from '../../../types/arena';

export function AdminLeaderboardsView() {
  const { games, subscribeBoard, removeLeaderboardEntry, resetLeaderboard } = useAdmin();

  const [boardKey, setBoardKey] = useState<string>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setConfirmReset(false);
    const unsub = subscribeBoard(boardKey, setEntries);
    return () => unsub();
  }, [boardKey, subscribeBoard]);

  const boardOptions = [
    { id: 'global', label: 'Global All-Time' },
    { id: 'weekly', label: 'Weekly Split' },
    { id: 'monthly', label: 'Monthly Ladder' },
    ...games.map((g) => ({ id: g.id, label: g.title })),
  ];

  const handleReset = async () => {
    await resetLeaderboard(boardKey);
    setConfirmReset(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Leaderboard Integrity & Seasonal Resets</h2>
          <p className="text-xs text-muted mt-0.5">
            Audit verified player scores across Global, Weekly, Monthly, and Game-Specific rankings.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          {confirmReset ? (
            <>
              <button
                type="button"
                onClick={() => void handleReset()}
                className="h-9 px-3.5 rounded-xl bg-red-500 text-white text-xs font-semibold whitespace-nowrap"
              >
                Confirm Reset "{boardKey}"
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="h-9 px-3 rounded-xl border border-line text-xs text-muted"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={entries.length === 0}
              className="h-9 px-3.5 rounded-xl border border-red-500/35 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Board</span>
            </button>
          )}
        </div>
      </div>

      {/* Board Selector */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-panel border border-line">
        {boardOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setBoardKey(opt.id)}
            className={`h-8 px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              boardKey === opt.id ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="arena-surface rounded-2xl p-10 text-center space-y-2">
          <Award className="w-8 h-8 text-muted mx-auto" />
          <p className="font-display font-semibold text-ink">No ranked entries on "{boardKey}"</p>
          <p className="text-xs text-muted">Verified competitive match completions populate this leaderboard automatically.</p>
        </div>
      ) : (
        <div className="arena-surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-panel/60 text-xs text-muted">
                  <th className="py-3 px-4 font-medium w-16">Rank</th>
                  <th className="py-3 px-4 font-medium">Competitor</th>
                  <th className="py-3 px-4 font-medium text-right">Score</th>
                  <th className="py-3 px-4 font-medium text-right">Wins / Played</th>
                  <th className="py-3 px-4 font-medium text-right">XP</th>
                  <th className="py-3 px-4 font-medium text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {entries.map((entry, idx) => (
                  <tr key={entry.uid} className="hover:bg-surface-elevated/45 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-[#22D3EE] tabular-nums">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          avatarId={entry.avatarId}
                          avatarUrl={entry.avatarUrl}
                          name={entry.displayName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">{entry.displayName}</p>
                          <p className="text-xs font-mono text-muted truncate">
                            @{entry.username} · Lvl {entry.level}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-ink tabular-nums">
                      {entry.score.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-muted tabular-nums">
                      {entry.wins} / {entry.gamesPlayed}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-muted tabular-nums">
                      {entry.xp.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void removeLeaderboardEntry(boardKey, entry)}
                        aria-label={`Remove ${entry.username} from ${boardKey} leaderboard`}
                        className="h-8 px-3 rounded-lg border border-red-500/30 text-xs font-medium text-red-300 hover:bg-red-500/15 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
