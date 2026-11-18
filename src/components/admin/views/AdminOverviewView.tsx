import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Coins,
  Flag,
  Gamepad2,
  Radio,
  ScrollText,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import { SANDBOX_7DAY_ACTIVITY } from '../../../data/adminSeed';

function formatRelativeTime(ts: number): string {
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60_000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export function AdminOverviewView() {
  const {
    analytics,
    auditLogs,
    deletionRequests,
    platformSettings,
    isSandboxMode,
    setActiveSection,
    tournaments,
    users,
  } = useAdmin();

  const pendingDeletions = deletionRequests.filter((d) => d.status === 'pending').length;

  // Build 7-day trend points (live user join distribution or sandbox benchmark when in sandbox)
  const chartPoints = useMemo(() => {
    if (isSandboxMode) return SANDBOX_7DAY_ACTIVITY;
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86_400_000);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86_400_000;
      const signups = users.filter((u) => u.joinDate >= dayStart && u.joinDate < dayEnd).length;
      const matches = users.reduce((acc, u) => {
        const count = (u.recentMatches || []).filter((m) => m.playedAt >= dayStart && m.playedAt < dayEnd).length;
        return acc + count;
      }, 0);
      return { label, matches, signups };
    });
    return days;
  }, [isSandboxMode, users]);

  const maxMatches = Math.max(10, ...chartPoints.map((p) => p.matches));
  const svgWidth = 560;
  const svgHeight = 180;
  const padX = 24;
  const padY = 18;
  const stepX = (svgWidth - padX * 2) / Math.max(1, chartPoints.length - 1);

  const polylinePoints = chartPoints
    .map((p, idx) => {
      const x = padX + idx * stepX;
      const y = svgHeight - padY - (p.matches / maxMatches) * (svgHeight - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPath = `M ${padX},${svgHeight - padY} L ${polylinePoints
    .split(' ')
    .join(' L ')} L ${padX + (chartPoints.length - 1) * stepX},${svgHeight - padY} Z`;

  const kpis = [
    {
      label: 'Total Players',
      value: analytics.totalUsers.toLocaleString(),
      sub: `${analytics.activeUsers} active · ${analytics.suspendedUsers + analytics.bannedUsers} restricted`,
      icon: Users,
      accent: 'text-[#8B5CF6]',
      onClick: () => setActiveSection('users'),
    },
    {
      label: 'Online Now',
      value: analytics.onlineUsers.toLocaleString(),
      sub: 'Live RTDB presence',
      icon: UserCheck,
      accent: 'text-[#22C55E]',
      onClick: () => setActiveSection('users'),
    },
    {
      label: 'Active Rooms',
      value: analytics.activeRooms.toLocaleString(),
      sub: `${analytics.inGameRooms} currently in match`,
      icon: Radio,
      accent: 'text-[#22D3EE]',
      onClick: () => setActiveSection('rooms'),
    },
    {
      label: 'Matches Logged',
      value: analytics.totalMatchesPlayed.toLocaleString(),
      sub: `${analytics.enabledGamesCount} of 5 titles enabled`,
      icon: Gamepad2,
      accent: 'text-[#3B82F6]',
      onClick: () => setActiveSection('games'),
    },
    {
      label: 'Open Reports',
      value: analytics.openReportsCount.toLocaleString(),
      sub: analytics.openReportsCount > 0 ? 'Requires moderator review' : 'Queue is clear',
      icon: Flag,
      accent: analytics.openReportsCount > 0 ? 'text-red-400' : 'text-[#22C55E]',
      onClick: () => setActiveSection('moderation'),
    },
    {
      label: 'Arena Economy',
      value: analytics.totalEconomyCoins.toLocaleString(),
      sub: 'Total Arena Coins held',
      icon: Coins,
      accent: 'text-amber-400',
      onClick: () => setActiveSection('users'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Header Strip */}
      <section className="arena-surface rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-mono text-[#22D3EE]">
            {platformSettings.platformName} · {platformSettings.maintenanceMode ? 'Maintenance Mode Enabled' : 'All Systems Operational'}
          </p>
          <h2 className="font-display text-2xl font-bold text-ink">Platform Command Overview</h2>
          <p className="text-sm text-muted">
            Real-time telemetry across player accounts, multiplayer lobbies, game catalog, and moderation queues.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection('announcements')}
            className="h-10 px-4 rounded-xl arena-gradient-btn text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Publish Notice</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className="h-10 px-4 rounded-xl bg-surface-elevated border border-line hover:border-[#8B5CF6]/50 text-xs font-semibold text-ink transition-colors whitespace-nowrap"
          >
            Platform Switches
          </button>
        </div>
      </section>

      {/* 6 KPI Grid */}
      <section aria-label="Platform metrics" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={kpi.onClick}
              className="arena-surface rounded-2xl p-4 text-left hover:border-[#8B5CF6]/45 transition-colors space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted truncate">{kpi.label}</span>
                <Icon className={`w-4 h-4 shrink-0 ${kpi.accent}`} />
              </div>
              <p className="font-display text-2xl font-bold text-ink tabular-nums">{kpi.value}</p>
              <p className="text-[11px] text-muted truncate">{kpi.sub}</p>
            </button>
          );
        })}
      </section>

      {/* Middle 2-Column Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* 7-Day Match Volume Chart */}
        <section className="lg:col-span-7 arena-surface rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-ink">7-Day Match & Signup Activity</h3>
              <p className="text-xs text-muted">
                {isSandboxMode ? 'Sandbox benchmark match telemetry' : 'Completed matches & registrations over last 7 days'}
              </p>
            </div>
            <div className="text-xs font-mono text-muted tabular-nums">
              Peak: <span className="text-ink font-semibold">{Math.max(...chartPoints.map((c) => c.matches))}</span> matches/day
            </div>
          </div>

          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              role="img"
              aria-label="7-day platform match activity chart"
              className="w-full h-44"
            >
              <defs>
                <linearGradient id="adminActivityArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = svgHeight - padY - ratio * (svgHeight - padY * 2);
                return (
                  <line
                    key={ratio}
                    x1={padX}
                    x2={svgWidth - padX}
                    y1={y}
                    y2={y}
                    stroke="rgba(148,163,184,0.14)"
                    strokeDasharray="3 4"
                  />
                );
              })}
              <path d={areaPath} fill="url(#adminActivityArea)" />
              <polyline
                fill="none"
                stroke="#22D3EE"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={polylinePoints}
              />
              {chartPoints.map((p, idx) => {
                const x = padX + idx * stepX;
                const y = svgHeight - padY - (p.matches / maxMatches) * (svgHeight - padY * 2);
                return (
                  <g key={p.label}>
                    <circle cx={x} cy={y} r="4" fill="#080A12" stroke="#8B5CF6" strokeWidth="2.5" />
                  </g>
                );
              })}
            </svg>
            <div className="grid grid-cols-7 gap-1 pt-2 border-t border-line text-center">
              {chartPoints.map((p) => (
                <div key={p.label} className="space-y-0.5">
                  <p className="text-[11px] font-medium text-muted">{p.label}</p>
                  <p className="text-xs font-mono font-semibold text-ink tabular-nums">{p.matches}</p>
                  <p className="text-[10px] font-mono text-[#22D3EE] tabular-nums">+{p.signups} new</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Game Popularity Distribution */}
        <section className="lg:col-span-5 arena-surface rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-ink">Game Engagement Share</h3>
              <p className="text-xs text-muted">Matches logged & live lobbies per title</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('games')}
              className="text-xs font-medium text-[#22D3EE] hover:underline whitespace-nowrap"
            >
              Manage Games
            </button>
          </div>

          <div className="space-y-3.5">
            {analytics.gameBreakdown.map((item) => (
              <div key={item.gameId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-ink truncate">
                    {item.title}
                    {!item.enabled && <span className="text-amber-400"> · Disabled</span>}
                  </span>
                  <span className="font-mono text-muted tabular-nums whitespace-nowrap">
                    {item.matchesPlayed} plays · {item.sharePercent}% · {item.activeRooms} live
                  </span>
                </div>
                <div className="h-2 rounded-full bg-panel overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] transition-all duration-300"
                    style={{ width: `${Math.max(item.matchesPlayed > 0 ? 6 : 0, item.sharePercent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-line flex items-center justify-between text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>{tournaments.length} scheduled tournaments</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveSection('tournaments')}
              className="text-[#22D3EE] hover:underline"
            >
              View Brackets
            </button>
          </div>
        </section>
      </div>

      {/* Bottom 2-Column Operational Queue & Recent Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Action Queue */}
        <section className="lg:col-span-5 arena-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-ink">Operational Action Queue</h3>
            <span className="text-xs font-mono text-muted tabular-nums">
              {analytics.openReportsCount + pendingDeletions} pending
            </span>
          </div>

          <div className="divide-y divide-line">
            <div className="py-3 first:pt-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Moderation Reports</p>
                <p className="text-xs text-muted">
                  {analytics.openReportsCount > 0
                    ? `${analytics.openReportsCount} open report${analytics.openReportsCount === 1 ? '' : 's'} awaiting review`
                    : 'No unresolved chat or conduct reports'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('moderation')}
                className="h-9 px-3 rounded-lg bg-surface-elevated border border-line hover:border-[#8B5CF6]/50 text-xs font-semibold text-ink whitespace-nowrap shrink-0"
              >
                Inspect
              </button>
            </div>

            <div className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Account Deletion Requests</p>
                <p className="text-xs text-muted">
                  {pendingDeletions > 0
                    ? `${pendingDeletions} pending player deletion ticket${pendingDeletions === 1 ? '' : 's'}`
                    : 'No pending account deletion requests'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('users')}
                className="h-9 px-3 rounded-lg bg-surface-elevated border border-line hover:border-[#8B5CF6]/50 text-xs font-semibold text-ink whitespace-nowrap shrink-0"
              >
                Review
              </button>
            </div>

            <div className="py-3 last:pb-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
                  {platformSettings.maintenanceMode && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  <span>Platform Access Controls</span>
                </p>
                <p className="text-xs text-muted">
                  Signup: {platformSettings.registrationEnabled ? 'Open' : 'Paused'} · Chat:{' '}
                  {platformSettings.chatEnabled ? 'On' : 'Off'} · Public Rooms:{' '}
                  {platformSettings.publicRoomsEnabled ? 'On' : 'Off'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('settings')}
                className="h-9 px-3 rounded-lg bg-surface-elevated border border-line hover:border-[#8B5CF6]/50 text-xs font-semibold text-ink whitespace-nowrap shrink-0"
              >
                Configure
              </button>
            </div>
          </div>
        </section>

        {/* Recent Audit Trail */}
        <section className="lg:col-span-7 arena-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-[#22D3EE]" />
              <h3 className="font-display text-base font-bold text-ink">Recent Admin Audit Trail</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('logs')}
              className="text-xs font-medium text-[#22D3EE] hover:underline whitespace-nowrap"
            >
              Full Audit Log
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">
              Administrative actions will appear here automatically once recorded.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {auditLogs.slice(0, 5).map((entry) => (
                <div key={entry.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-ink">
                      {entry.action} <span className="text-muted">·</span>{' '}
                      <span className="font-mono text-xs text-[#22D3EE]">{entry.target}</span>
                    </p>
                    <p className="text-xs text-muted truncate">{entry.details}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-muted tabular-nums">{formatRelativeTime(entry.timestamp)}</p>
                    <p className="text-[11px] text-muted/80">{entry.category}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
