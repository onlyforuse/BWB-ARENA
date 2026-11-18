import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  RotateCcw,
  Search,
  ShieldBan,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import {
  filterAdminUsers,
  validateEconomyAdjustment,
  type AdminUserSortKey,
} from '../../../lib/adminRules';
import { Avatar } from '../../common/Avatar';
import type { AccountStatus, PlayerProfile } from '../../../types/arena';

function statusColor(status: AccountStatus): string {
  if (status === 'active') return 'text-[#22C55E]';
  if (status === 'suspended') return 'text-amber-400';
  return 'text-red-400';
}

export function AdminUsersView() {
  const {
    users,
    deletionRequests,
    updateUserStatus,
    adjustUserEconomy,
    resetUserStats,
    processDeletionRequest,
  } = useAdmin();

  const [subTab, setSubTab] = useState<'directory' | 'deletions'>('directory');
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'player' | 'admin'>('all');
  const [sortBy, setSortBy] = useState<AdminUserSortKey>('xp');

  // Selected user modal state
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const selectedUser: PlayerProfile | null = useMemo(
    () => users.find((u) => u.uid === selectedUid) || null,
    [users, selectedUid],
  );

  const [nextStatus, setNextStatus] = useState<AccountStatus>('active');
  const [statusReason, setStatusReason] = useState('');
  const [coinsDelta, setCoinsDelta] = useState('0');
  const [xpDelta, setXpDelta] = useState('0');
  const [economyReason, setEconomyReason] = useState('');
  const [modalError, setModalError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  const filteredUsers = useMemo(
    () =>
      filterAdminUsers(users, {
        query: queryText,
        status: statusFilter,
        role: roleFilter,
        sortBy,
      }),
    [users, queryText, statusFilter, roleFilter, sortBy],
  );

  const pendingDeletionsCount = deletionRequests.filter((d) => d.status === 'pending').length;

  const openManageModal = (user: PlayerProfile) => {
    setSelectedUid(user.uid);
    setNextStatus(user.status);
    setStatusReason('');
    setCoinsDelta('0');
    setXpDelta('0');
    setEconomyReason('');
    setModalError('');
    setConfirmReset(false);
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setModalError('');
    setBusy(true);
    try {
      await updateUserStatus(selectedUser, nextStatus, statusReason);
      setStatusReason('');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEconomy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setModalError('');
    const cDelta = Number(coinsDelta);
    const xDelta = Number(xpDelta);
    if (cDelta === 0 && xDelta === 0) {
      setModalError('Enter a non-zero Coins or XP adjustment.');
      return;
    }
    const validation = validateEconomyAdjustment({
      currentCoins: selectedUser.coins,
      currentXp: selectedUser.xp,
      coinsDelta: cDelta,
      xpDelta: xDelta,
    });
    if (!validation.valid) {
      setModalError(validation.error || 'Invalid economy values.');
      return;
    }
    setBusy(true);
    try {
      await adjustUserEconomy(selectedUser, {
        nextCoins: validation.nextCoins,
        nextXp: validation.nextXp,
        nextLevel: validation.nextLevel,
        coinsDelta: cDelta,
        xpDelta: xDelta,
        reason: economyReason.trim() || 'Super Admin economy update',
      });
      setCoinsDelta('0');
      setXpDelta('0');
      setEconomyReason('');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Economy update failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetStats = async () => {
    if (!selectedUser) return;
    setBusy(true);
    setModalError('');
    try {
      await resetUserStats(selectedUser, 'Administrative match history reset');
      setConfirmReset(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to reset match stats.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation & Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">User Accounts & Economy Control</h2>
          <p className="text-xs text-muted mt-0.5 tabular-nums">
            {users.length} registered accounts · {users.filter((u) => u.online).length} online now
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-panel border border-line self-start">
          <button
            type="button"
            onClick={() => setSubTab('directory')}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'directory' ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
            }`}
          >
            All Players ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('deletions')}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'deletions' ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
            }`}
          >
            Deletion Tickets ({pendingDeletionsCount})
          </button>
        </div>
      </div>

      {subTab === 'directory' ? (
        <>
          {/* Search & Filters */}
          <div className="arena-surface rounded-2xl p-4 flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Search users by username, name, email, or UID"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Search by @username, name, email, or UID..."
                className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-panel border border-line">
                {(['all', 'active', 'suspended', 'banned'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`h-8 px-2.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                      statusFilter === st ? 'bg-surface-elevated text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <select
                aria-label="Filter by role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | 'player' | 'admin')}
                className="h-10 px-3 rounded-xl bg-panel border border-line text-xs text-ink focus:outline-none focus:border-[#8B5CF6]"
              >
                <option value="all">All Roles</option>
                <option value="player">Players</option>
                <option value="admin">Admins</option>
              </select>

              <select
                aria-label="Sort players by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as AdminUserSortKey)}
                className="h-10 px-3 rounded-xl bg-panel border border-line text-xs text-ink focus:outline-none focus:border-[#8B5CF6]"
              >
                <option value="xp">Sort: Highest XP</option>
                <option value="coins">Sort: Most Coins</option>
                <option value="wins">Sort: Most Wins</option>
                <option value="newest">Sort: Newest Joined</option>
                <option value="username">Sort: Username A–Z</option>
              </select>
            </div>
          </div>

          {/* Desktop High-Density Table */}
          {filteredUsers.length === 0 ? (
            <div className="arena-surface rounded-2xl p-10 text-center space-y-2">
              <p className="font-display font-semibold text-ink">No matching player accounts</p>
              <p className="text-xs text-muted">Adjust your search term or status filter to view more users.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block arena-surface rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-line bg-panel/60 text-xs text-muted">
                        <th className="py-3 px-4 font-medium">Player</th>
                        <th className="py-3 px-4 font-medium">Status & Role</th>
                        <th className="py-3 px-4 font-medium text-right">Level / XP</th>
                        <th className="py-3 px-4 font-medium text-right">Coins</th>
                        <th className="py-3 px-4 font-medium text-right">W / L</th>
                        <th className="py-3 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-sm">
                      {filteredUsers.map((user) => (
                        <tr key={user.uid} className="hover:bg-surface-elevated/45 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar
                                avatarId={user.avatarId}
                                avatarUrl={user.avatarUrl}
                                name={user.displayName}
                                size="sm"
                                online={user.online}
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-ink truncate">{user.displayName}</p>
                                <p className="text-xs font-mono text-muted truncate">
                                  @{user.username} · {user.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs whitespace-nowrap">
                            <span className={`font-semibold capitalize ${statusColor(user.status)}`}>
                              {user.status}
                            </span>
                            <span className="text-muted"> · {user.role === 'admin' ? 'Admin' : 'Player'}</span>
                            <span className="text-muted"> · {user.online ? 'Online' : 'Offline'}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                            <span className="text-ink font-semibold">Lvl {user.level}</span>
                            <span className="text-muted"> · {user.xp.toLocaleString()} XP</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-amber-400 tabular-nums whitespace-nowrap">
                            {user.coins.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-muted tabular-nums whitespace-nowrap">
                            <span className="text-ink">{user.wins}W</span> / {user.losses}L ({user.gamesPlayed})
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openManageModal(user)}
                              aria-label={`Manage ${user.username}`}
                              className="h-8 px-3 rounded-lg bg-surface-elevated border border-line hover:border-[#8B5CF6]/55 text-xs font-semibold text-ink inline-flex items-center gap-1.5 transition-colors"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-[#22D3EE]" />
                              <span>Manage</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card Stack */}
              <div className="md:hidden space-y-3">
                {filteredUsers.map((user) => (
                  <article key={user.uid} className="arena-surface rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          avatarId={user.avatarId}
                          avatarUrl={user.avatarUrl}
                          name={user.displayName}
                          size="sm"
                          online={user.online}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-ink truncate">{user.displayName}</p>
                          <p className="text-xs font-mono text-muted truncate">@{user.username}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold capitalize ${statusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-line text-xs font-mono tabular-nums">
                      <div>
                        <span className="block text-[11px] font-sans text-muted">Level / XP</span>
                        <span className="text-ink font-semibold">Lvl {user.level} · {user.xp}</span>
                      </div>
                      <div>
                        <span className="block text-[11px] font-sans text-muted">Coins</span>
                        <span className="text-amber-400 font-semibold">{user.coins.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="block text-[11px] font-sans text-muted">Record</span>
                        <span className="text-ink">{user.wins}W / {user.losses}L</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openManageModal(user)}
                      className="w-full min-h-[44px] rounded-xl bg-surface-elevated border border-line text-xs font-semibold text-ink inline-flex items-center justify-center gap-2"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#22D3EE]" />
                      <span>Manage @{user.username}</span>
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        /* Deletion Requests Queue */
        <section className="arena-surface rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-ink">Player Account Deletion Tickets</h3>
            <p className="text-xs text-muted">
              Review user-submitted requests from Settings. Approving locks the account immediately and logs an audit ticket.
            </p>
          </div>

          {deletionRequests.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">No account deletion requests have been submitted.</p>
          ) : (
            <div className="divide-y divide-line">
              {deletionRequests.map((req) => (
                <div key={req.uid} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      @{req.username} <span className="text-muted font-normal">· {req.email}</span>
                    </p>
                    <p className="text-xs text-muted">{req.reason}</p>
                    <p className="text-[11px] font-mono text-muted">
                      Status:{' '}
                      <span
                        className={
                          req.status === 'pending'
                            ? 'text-amber-400'
                            : req.status === 'approved'
                              ? 'text-red-400'
                              : 'text-[#22C55E]'
                        }
                      >
                        {req.status}
                      </span>{' '}
                      · Requested {new Date(req.requestedAt).toLocaleString()}
                    </p>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void processDeletionRequest(req, 'approved')}
                        className="h-9 px-3.5 rounded-xl bg-red-500/15 border border-red-500/35 text-xs font-semibold text-red-300 hover:bg-red-500/25 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Approve & Lock</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void processDeletionRequest(req, 'rejected')}
                        className="h-9 px-3.5 rounded-xl bg-surface-elevated border border-line text-xs font-semibold text-ink hover:border-[#22D3EE]/50 transition-colors whitespace-nowrap"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Manage Player Modal */}
      {selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Manage player ${selectedUser.username}`}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedUid(null)}
        >
          <div
            className="arena-surface rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  avatarId={selectedUser.avatarId}
                  avatarUrl={selectedUser.avatarUrl}
                  name={selectedUser.displayName}
                  size="md"
                  online={selectedUser.online}
                />
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold text-ink truncate">{selectedUser.displayName}</h3>
                  <p className="text-xs font-mono text-muted truncate">
                    @{selectedUser.username} · {selectedUser.email}
                  </p>
                  <p className="text-xs font-mono text-muted tabular-nums mt-0.5">
                    Lvl {selectedUser.level} · {selectedUser.xp.toLocaleString()} XP ·{' '}
                    <span className="text-amber-400">{selectedUser.coins.toLocaleString()} Coins</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUid(null)}
                aria-label="Close manage player dialog"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-ink hover:bg-surface-elevated shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-300">
                {modalError}
              </div>
            )}

            {/* Section 1: Account Status */}
            <form onSubmit={handleSaveStatus} className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldBan className="w-4 h-4 text-[#8B5CF6]" />
                <h4 className="font-display text-sm font-bold text-ink">Account Status Enforcement</h4>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['active', 'suspended', 'banned'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setNextStatus(st)}
                    className={`h-10 rounded-xl border text-xs font-semibold capitalize transition-colors ${
                      nextStatus === st
                        ? st === 'active'
                          ? 'bg-[#22C55E]/15 border-[#22C55E]/45 text-[#22C55E]'
                          : st === 'suspended'
                            ? 'bg-amber-500/15 border-amber-500/45 text-amber-300'
                            : 'bg-red-500/15 border-red-500/45 text-red-300'
                        : 'bg-panel border-line text-muted hover:text-ink'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <input
                type="text"
                aria-label="Status change reason"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Audit reason (optional, e.g. Unsportsmanlike chat conduct)..."
                className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-xs text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
              />
              <button
                type="submit"
                disabled={busy}
                className="h-9 px-4 rounded-xl arena-gradient-btn text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Apply Status ({nextStatus})</span>
              </button>
            </form>

            {/* Section 2: Economy (Coins & XP) */}
            <form onSubmit={handleSaveEconomy} className="space-y-3 pt-4 border-t border-line">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <h4 className="font-display text-sm font-bold text-ink">Adjust Coins & XP</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="admin-coins-delta" className="block text-xs text-muted">
                    Coins Delta (+/-)
                  </label>
                  <input
                    id="admin-coins-delta"
                    type="number"
                    value={coinsDelta}
                    onChange={(e) => setCoinsDelta(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm font-mono text-ink tabular-nums focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="admin-xp-delta" className="block text-xs text-muted">
                    XP Delta (+/-)
                  </label>
                  <input
                    id="admin-xp-delta"
                    type="number"
                    value={xpDelta}
                    onChange={(e) => setXpDelta(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-panel border border-line text-sm font-mono text-ink tabular-nums focus:outline-none focus:border-[#8B5CF6]"
                  />
                </div>
              </div>
              <input
                type="text"
                aria-label="Economy adjustment note"
                value={economyReason}
                onChange={(e) => setEconomyReason(e.target.value)}
                placeholder="Reason for adjustment (e.g. Tournament payout, bug compensation)..."
                className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-xs text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
              />
              <button
                type="submit"
                disabled={busy}
                className="h-9 px-4 rounded-xl bg-surface-elevated border border-line hover:border-[#22D3EE]/60 text-xs font-semibold text-ink transition-colors"
              >
                Apply Economy Adjustment
              </button>
            </form>

            {/* Section 3: Reset Match Stats */}
            <div className="pt-4 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Reset Competitive Stats</p>
                <p className="text-xs text-muted">Clears wins, losses, games played, and streaks to zero.</p>
              </div>
              {confirmReset ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleResetStats()}
                    className="h-9 px-3 rounded-xl bg-red-500 text-white text-xs font-semibold"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="h-9 px-3 rounded-xl border border-line text-xs text-muted"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="h-9 px-3.5 rounded-xl border border-red-500/35 text-xs font-semibold text-red-300 hover:bg-red-500/10 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Stats</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
