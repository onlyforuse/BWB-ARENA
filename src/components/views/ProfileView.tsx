import React, { useEffect, useState } from 'react';
import { Award, Calendar, Check, Edit3, Trophy, Upload, X } from 'lucide-react';
import { useArena } from '../../context/ArenaContext';
import { ACHIEVEMENT_DEFINITIONS, AVATAR_PRESETS } from '../../data/catalog';
import { calculateLevelFromXp, calculateWinRate } from '../../lib/gameRules';
import { Avatar } from '../common/Avatar';

export function ProfileView() {
  const { player, friends, updateProfile, uploadAvatarFile, loadLeaderboard, pushToast } = useArena();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(player?.displayName || '');
  const [bio, setBio] = useState(player?.bio || '');
  const [avatarId, setAvatarId] = useState(player?.avatarId || 'cyber-wolf');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [globalRank, setGlobalRank] = useState<number | null>(null);

  useEffect(() => {
    if (!player) return;
    setDisplayName(player.displayName);
    setBio(player.bio);
    setAvatarId(player.avatarId);
  }, [player?.displayName, player?.bio, player?.avatarId]);

  useEffect(() => {
    if (!player) return;
    return loadLeaderboard('global', (entries) => {
      const idx = entries.findIndex((e) => e.uid === player.uid);
      setGlobalRank(idx >= 0 ? idx + 1 : null);
    });
  }, [player, loadLeaderboard]);

  if (!player) return null;

  const levelInfo = calculateLevelFromXp(player.xp);
  const winRate = calculateWinRate(player.wins, player.gamesPlayed);

  const unlockedAchievements = ACHIEVEMENT_DEFINITIONS.filter((a) => {
    if (a.metric === 'wins') return player.wins >= a.target;
    if (a.metric === 'gamesPlayed') return player.gamesPlayed >= a.target;
    if (a.metric === 'level') return levelInfo.level >= a.target;
    if (a.metric === 'friends') return friends.length >= a.target;
    if (a.metric === 'streak') return player.bestStreak >= a.target;
    return false;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim().length < 2) {
      pushToast({ tone: 'danger', title: 'Invalid Display Name', message: 'Use at least 2 characters.' });
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ displayName: displayName.trim(), bio: bio.trim(), avatarId });
      setEditing(false);
    } catch (err) {
      pushToast({
        tone: 'danger',
        title: 'Profile Update Failed',
        message: err instanceof Error ? err.message : 'Unable to save profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatarFile(file);
    } catch (err) {
      pushToast({
        tone: 'danger',
        title: 'Avatar Upload Failed',
        message: err instanceof Error ? err.message : 'Ensure Firebase Storage is enabled for bwb-arena.',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Profile Header Card */}
      <section className="arena-surface rounded-2xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar
              avatarId={player.avatarId}
              avatarUrl={player.avatarUrl}
              name={player.displayName}
              size="xl"
              online={player.online}
              showPresence
            />
            <div className="space-y-1">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-ink">
                {player.displayName}
              </h2>
              <p className="text-sm font-mono text-[#22D3EE]">
                @{player.username} · Level {levelInfo.level}
              </p>
              <p className="text-xs text-muted inline-flex items-center gap-1.5 pt-0.5">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                Joined {new Date(player.joinDate).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })}
                <span aria-hidden="true">·</span>
                Rank {globalRank ? `#${globalRank}` : 'Unranked'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="h-10 px-3.5 rounded-xl bg-panel border border-line text-xs font-semibold text-ink hover:border-[#22D3EE]/50 inline-flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span>{uploading ? 'Uploading...' : 'Upload Photo'}</span>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="sr-only" />
            </label>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="arena-gradient-btn h-10 px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
            >
              {editing ? <X className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              <span>{editing ? 'Cancel' : 'Edit Profile'}</span>
            </button>
          </div>
        </div>

        {/* Bio or Inline Editor */}
        {!editing ? (
          <p className="text-sm text-muted leading-relaxed max-w-2xl">{player.bio}</p>
        ) : (
          <form onSubmit={handleSave} className="pt-4 border-t border-line space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-displayname" className="block text-xs font-medium text-muted mb-1.5">
                  Display Name
                </label>
                <input
                  id="profile-displayname"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={32}
                  className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label htmlFor="profile-username-ro" className="block text-xs font-medium text-muted mb-1.5">
                  Unique Username (Permanent)
                </label>
                <input
                  id="profile-username-ro"
                  type="text"
                  value={`@${player.username}`}
                  disabled
                  className="w-full h-10 px-3.5 rounded-xl bg-panel/60 border border-line font-mono text-sm text-muted cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-bio" className="block text-xs font-medium text-muted mb-1.5">
                Player Bio
              </label>
              <textarea
                id="profile-bio"
                rows={3}
                maxLength={180}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-3 rounded-xl bg-panel border border-line text-sm text-ink focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-muted mb-2">Esports Emblem Avatar</span>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setAvatarId(preset.id)}
                    aria-label={`Select ${preset.label} avatar`}
                    className={`relative h-11 rounded-xl bg-gradient-to-br ${preset.bg} text-white font-display text-xs font-bold flex items-center justify-center border-2 ${
                      avatarId === preset.id ? 'border-[#22D3EE]' : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    {preset.glyph}
                    {avatarId === preset.id && <Check className="w-3 h-3 absolute top-1 right-1" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="arena-gradient-btn h-10 px-5 rounded-xl text-xs font-semibold"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-10 px-4 rounded-xl bg-panel border border-line text-xs font-semibold text-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Career Stat Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-line font-mono tabular-nums">
          {[
            { label: 'Level', value: String(levelInfo.level), accent: 'text-ink' },
            { label: 'Total XP', value: player.xp.toLocaleString(), accent: 'text-[#8B5CF6]' },
            { label: 'Coins', value: player.coins.toLocaleString(), accent: 'text-amber-400' },
            { label: 'Games', value: String(player.gamesPlayed), accent: 'text-ink' },
            { label: 'Wins / Losses', value: `${player.wins} / ${player.losses}`, accent: 'text-[#22C55E]' },
            { label: 'Win %', value: `${winRate}%`, accent: 'text-[#22D3EE]' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-panel border border-line p-3">
              <p className="text-[11px] font-sans text-muted">{stat.label}</p>
              <p className={`text-lg font-bold mt-0.5 ${stat.accent}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Split: Unlocked Achievements & Recent Game History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="arena-surface rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-ink">Unlocked Achievements</h3>
            <Award className="w-4 h-4 text-[#8B5CF6]" aria-hidden="true" />
          </div>
          {unlockedAchievements.length === 0 ? (
            <p className="text-xs text-muted leading-relaxed">
              Win your first match or connect with friends to showcase unlocked career milestones here.
            </p>
          ) : (
            <div className="space-y-2.5">
              {unlockedAchievements.map((ach) => (
                <div key={ach.id} className="rounded-xl bg-panel border border-line p-3 flex items-center gap-3">
                  <Trophy className="w-4 h-4 text-[#22C55E] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink">{ach.title}</p>
                    <p className="text-[11px] text-muted truncate">{ach.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-2 arena-surface rounded-2xl p-5 space-y-3.5">
          <h3 className="font-display text-base font-bold text-ink">Recent Match History</h3>
          {player.recentMatches.length === 0 ? (
            <p className="text-xs text-muted py-4">
              No matches played yet in this profile. Launch any arena game to log your recent performance.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-line text-muted font-mono uppercase">
                    <th className="py-2 pr-3">Game</th>
                    <th className="py-2 px-3">Opponent</th>
                    <th className="py-2 px-3">Result</th>
                    <th className="py-2 px-3 text-right">Score</th>
                    <th className="py-2 pl-3 text-right">Rewards</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {player.recentMatches.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2.5 pr-3 font-semibold text-ink">{m.gameTitle}</td>
                      <td className="py-2.5 px-3 text-muted">{m.opponentName}</td>
                      <td className="py-2.5 px-3 font-semibold uppercase">
                        <span
                          className={
                            m.outcome === 'win'
                              ? 'text-[#22C55E]'
                              : m.outcome === 'loss'
                                ? 'text-[#EF4444]'
                                : 'text-amber-400'
                          }
                        >
                          {m.outcome}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-ink">{m.score}</td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-[#22D3EE]">
                        +{m.xpEarned} XP · +{m.coinsEarned}c
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
