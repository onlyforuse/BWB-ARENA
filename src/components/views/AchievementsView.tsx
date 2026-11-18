import { Award, CheckCircle2, Coins, Lock, ShieldCheck, Trophy } from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import { ACHIEVEMENT_DEFINITIONS, DAILY_CHALLENGES } from '../../data/catalog';
import { calculateLevelFromXp } from '../../lib/gameRules';

export function AchievementsView() {
  const { player, friends, claimedChallenges, claimDailyChallenge } = useArena();

  if (!player) return null;

  const levelInfo = calculateLevelFromXp(player.xp);

  const getDailyProgress = (metric: (typeof DAILY_CHALLENGES)[number]['metric']): number => {
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

  const getAchievementValue = (metric: (typeof ACHIEVEMENT_DEFINITIONS)[number]['metric']): number => {
    switch (metric) {
      case 'wins':
        return player.wins;
      case 'gamesPlayed':
        return player.gamesPlayed;
      case 'level':
        return levelInfo.level;
      case 'friends':
        return friends.length;
      case 'streak':
        return player.bestStreak;
      default:
        return 0;
    }
  };

  const unlockedCount = ACHIEVEMENT_DEFINITIONS.filter(
    (a) => getAchievementValue(a.metric) >= a.target,
  ).length;

  return (
    <div className="space-y-6">
      {/* Level & Economy Progress Card */}
      <section className="arena-surface rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 flex-1">
          <p className="text-xs font-mono text-[#22D3EE] tabular-nums">
            Season Progression · {unlockedCount}/{ACHIEVEMENT_DEFINITIONS.length} Achievements Unlocked
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
            Player Level {levelInfo.level}
          </h2>
          <div className="flex items-center gap-3 max-w-lg pt-1">
            <div className="flex-1 h-2.5 rounded-full bg-panel overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] via-[#3B82F6] to-[#22D3EE]"
                style={{ width: `${levelInfo.progressPercent}%` }}
              />
            </div>
            <span className="font-mono text-xs text-muted tabular-nums shrink-0">
              {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 shrink-0">
          <div className="rounded-xl bg-panel border border-line px-4 py-3">
            <p className="text-xs text-muted inline-flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#8B5CF6]" /> Total XP
            </p>
            <p className="font-mono text-xl font-bold text-ink tabular-nums mt-1">
              {player.xp.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl bg-panel border border-line px-4 py-3">
            <p className="text-xs text-muted inline-flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> Arena Coins
            </p>
            <p className="font-mono text-xl font-bold text-amber-400 tabular-nums mt-1">
              {player.coins.toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      {/* Daily Challenges */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">Daily Challenges</h3>
            <p className="text-xs text-muted">
              Reward claims validate match records through trusted backend rules
            </p>
          </div>
          <span className="text-xs text-muted inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#22C55E]" aria-hidden="true" />
            Protected Balance
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DAILY_CHALLENGES.map((ch) => {
            const current = Math.min(ch.target, getDailyProgress(ch.metric));
            const pct = Math.round((current / ch.target) * 100);
            const completed = current >= ch.target;
            const claimed = Boolean(claimedChallenges[ch.id]);

            return (
              <article key={ch.id} className="arena-surface rounded-2xl p-5 flex flex-col justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-[#22D3EE]">
                      +{ch.xpReward} XP · +{ch.coinReward} Coins
                    </span>
                    <span className="text-muted">
                      {current}/{ch.target}
                    </span>
                  </div>
                  <h4 className="font-display text-base font-bold text-ink">{ch.title}</h4>
                  <p className="text-xs text-muted leading-relaxed">{ch.description}</p>
                </div>

                <div className="space-y-3">
                  <div className="h-2 rounded-full bg-panel overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {claimed ? (
                    <div className="h-9 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/35 text-[#22C55E] text-xs font-semibold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Reward Claimed</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!completed}
                      onClick={() => claimDailyChallenge(ch.id, ch.xpReward, ch.coinReward)}
                      className="w-full h-9 arena-gradient-btn rounded-xl text-xs font-semibold disabled:opacity-45"
                    >
                      {completed ? 'Claim Reward' : `${ch.target - current} More Needed`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Achievement Milestones */}
      <section className="space-y-3.5">
        <h3 className="font-display text-lg font-bold text-ink">Career Milestones</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACHIEVEMENT_DEFINITIONS.map((ach) => {
            const val = Math.min(ach.target, getAchievementValue(ach.metric));
            const unlocked = val >= ach.target;
            const pct = Math.round((val / ach.target) * 100);

            return (
              <article
                key={ach.id}
                className={`arena-surface rounded-2xl p-5 space-y-3 ${
                  unlocked ? 'border-[#22C55E]/40' : 'opacity-90'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      unlocked ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-panel text-muted'
                    }`}
                  >
                    {unlocked ? <Trophy className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <span className="font-mono text-xs text-muted tabular-nums">
                    {ach.tier} · {val}/{ach.target}
                  </span>
                </div>

                <div>
                  <h4 className="font-display text-base font-bold text-ink">{ach.title}</h4>
                  <p className="text-xs text-muted mt-1 leading-relaxed">{ach.description}</p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="h-1.5 rounded-full bg-panel overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        unlocked ? 'bg-[#22C55E]' : 'bg-[#8B5CF6]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-muted tabular-nums">
                    Milestone Reward: +{ach.xpReward} XP · +{ach.coinReward} Coins
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
