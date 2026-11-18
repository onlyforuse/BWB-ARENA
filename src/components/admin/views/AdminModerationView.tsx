import { useMemo, useState } from 'react';
import { CheckCircle2, ShieldAlert, ShieldBan, Trash2, XCircle } from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import type { AdminReport, ReportStatus } from '../../../types/arena';

export function AdminModerationView() {
  const { reports, users, updateReportStatus, updateUserStatus } = useAdmin();
  const [statusFilter, setStatusFilter] = useState<'open' | 'all' | 'resolved' | 'dismissed'>('open');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const visibleReports = useMemo(() => {
    if (statusFilter === 'all') return reports;
    return reports.filter((r) => r.status === statusFilter);
  }, [reports, statusFilter]);

  const handleResolve = async (report: AdminReport, status: ReportStatus, deleteMessage = false) => {
    setBusyId(report.id);
    try {
      await updateReportStatus(report, status, notes[report.id] || '', deleteMessage);
    } finally {
      setBusyId(null);
    }
  };

  const handleEnforceUser = async (report: AdminReport, enforcement: 'suspended' | 'banned') => {
    const targetUser = users.find((u) => u.uid === report.reportedUid);
    if (!targetUser) return;
    setBusyId(report.id);
    try {
      await updateUserStatus(targetUser, enforcement, `Moderation report #${report.id}: ${report.reason}`);
      await updateReportStatus(
        report,
        'resolved',
        notes[report.id] || `Account ${enforcement} following report review.`,
        Boolean(report.messageId),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Trust, Safety & Chat Moderation</h2>
          <p className="text-xs text-muted mt-0.5 tabular-nums">
            {reports.filter((r) => r.status === 'open').length} open · {reports.filter((r) => r.status === 'resolved').length}{' '}
            resolved · {reports.length} total tickets
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-panel border border-line self-start">
          {(['open', 'resolved', 'dismissed', 'all'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                statusFilter === tab ? 'bg-[#8B5CF6] text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {visibleReports.length === 0 ? (
        <div className="arena-surface rounded-2xl p-10 text-center space-y-2">
          <p className="font-display font-semibold text-ink">No {statusFilter === 'all' ? '' : statusFilter} reports</p>
          <p className="text-xs text-muted">Player reports submitted from room chat or match lobbies appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleReports.map((report) => {
            const targetUser = users.find((u) => u.uid === report.reportedUid);
            const isOpen = report.status === 'open';
            const isBusy = busyId === report.id;

            return (
              <article key={report.id} className="arena-surface rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted">
                      <span
                        className={`font-semibold uppercase ${
                          report.status === 'open'
                            ? 'text-red-400'
                            : report.status === 'resolved'
                              ? 'text-[#22C55E]'
                              : 'text-muted'
                        }`}
                      >
                        {report.status}
                      </span>
                      <span>·</span>
                      <span>{report.type.replace('_', ' ')}</span>
                      <span>·</span>
                      <span>{new Date(report.createdAt).toLocaleString()}</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-ink">
                      Reported: <span className="font-mono text-[#22D3EE]">@{report.reportedUsername}</span>
                      {targetUser && (
                        <span className="text-xs font-normal text-muted"> (currently {targetUser.status})</span>
                      )}
                    </h3>
                    <p className="text-xs text-muted">
                      Submitted by <span className="font-mono text-ink">@{report.reporterUsername}</span> — {report.reason}
                    </p>
                  </div>
                </div>

                {report.messageText && (
                  <div className="rounded-xl bg-panel border border-line p-3.5 space-y-1">
                    <p className="text-[11px] font-mono text-muted">
                      Reported Chat Excerpt {report.roomId ? `· Room ${report.roomId}` : ''}
                      {report.messageDeleted ? ' · Redacted' : ''}
                    </p>
                    <p className="text-sm text-ink break-words">“{report.messageText}”</p>
                  </div>
                )}

                {isOpen ? (
                  <div className="space-y-3 pt-1">
                    <input
                      type="text"
                      aria-label={`Moderator resolution note for ${report.reportedUsername}`}
                      value={notes[report.id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                      placeholder="Add moderator decision note..."
                      className="w-full h-10 px-3.5 rounded-xl bg-panel border border-line text-xs text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      {report.messageId && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleResolve(report, 'resolved', true)}
                          className="h-9 px-3.5 rounded-xl arena-gradient-btn text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Message & Resolve</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleResolve(report, 'resolved', false)}
                        className="h-9 px-3.5 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/40 text-xs font-semibold text-[#22C55E] inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleResolve(report, 'dismissed', false)}
                        className="h-9 px-3.5 rounded-xl bg-surface-elevated border border-line text-xs font-semibold text-muted hover:text-ink inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Dismiss</span>
                      </button>

                      {targetUser && targetUser.status !== 'suspended' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleEnforceUser(report, 'suspended')}
                          className="h-9 px-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-xs font-semibold text-amber-300 inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Suspend User</span>
                        </button>
                      )}

                      {targetUser && targetUser.status !== 'banned' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleEnforceUser(report, 'banned')}
                          className="h-9 px-3.5 rounded-xl bg-red-500/15 border border-red-500/35 text-xs font-semibold text-red-300 inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <ShieldBan className="w-3.5 h-3.5" />
                          <span>Ban User</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted border-t border-line pt-3">
                    Decision: <span className="text-ink">{report.resolutionNote || report.status}</span>
                    {report.resolvedBy ? ` · Reviewed by ${report.resolvedBy}` : ''}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
