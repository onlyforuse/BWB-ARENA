import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useAdmin } from '../../../context/AdminContext';
import { formatAuditLogsCsv } from '../../../lib/adminRules';
import type { AdminAuditCategory } from '../../../types/arena';

const CATEGORIES: Array<'all' | AdminAuditCategory> = [
  'all',
  'user',
  'economy',
  'game',
  'room',
  'moderation',
  'announcement',
  'tournament',
  'leaderboard',
  'settings',
];

export function AdminAuditLogsView() {
  const { auditLogs } = useAdmin();
  const [category, setCategory] = useState<'all' | AdminAuditCategory>('all');
  const [queryText, setQueryText] = useState('');

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (!q) return true;
      return (
        entry.action.toLowerCase().includes(q) ||
        entry.target.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q) ||
        entry.adminEmail.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, category, queryText]);

  const handleExportCsv = () => {
    const csv = formatAuditLogsCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bwb-arena-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Immutable Admin Audit Logs</h2>
          <p className="text-xs text-muted mt-0.5 tabular-nums">
            {filtered.length} recorded event{filtered.length === 1 ? '' : 's'} shown · synced with{' '}
            <code className="font-mono text-ink">/adminLogs</code>
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
          className="h-10 px-4 rounded-xl bg-surface-elevated border border-line hover:border-[#22D3EE]/50 text-xs font-semibold text-ink inline-flex items-center gap-1.5 disabled:opacity-40 self-start whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-[#22D3EE]" />
          <span>Download CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="arena-surface rounded-2xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Search audit logs"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Filter by action, target username, admin email, or detail..."
            className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-panel border border-line text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>

        <select
          aria-label="Filter audit logs by category"
          value={category}
          onChange={(e) => setCategory(e.target.value as 'all' | AdminAuditCategory)}
          className="h-10 px-3.5 rounded-xl bg-panel border border-line text-xs text-ink capitalize focus:outline-none focus:border-[#8B5CF6]"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All Categories' : c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="arena-surface rounded-2xl p-10 text-center space-y-2">
          <p className="font-display font-semibold text-ink">No matching audit log entries</p>
          <p className="text-xs text-muted">Administrative actions are recorded chronologically here.</p>
        </div>
      ) : (
        <div className="arena-surface rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-panel/60 text-xs text-muted">
                  <th className="py-3 px-4 font-medium whitespace-nowrap">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Action & Category</th>
                  <th className="py-3 px-4 font-medium">Target</th>
                  <th className="py-3 px-4 font-medium">Details</th>
                  <th className="py-3 px-4 font-medium text-right">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-elevated/45 transition-colors">
                    <td className="py-3 px-4 font-mono text-muted tabular-nums whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-ink">{entry.action}</span>
                      <span className="text-muted capitalize"> · {entry.category}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#22D3EE] whitespace-nowrap">{entry.target}</td>
                    <td className="py-3 px-4 text-muted max-w-md">{entry.details}</td>
                    <td className="py-3 px-4 text-right font-mono text-muted whitespace-nowrap">{entry.adminEmail}</td>
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
