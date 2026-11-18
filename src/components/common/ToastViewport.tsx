import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useArena } from '../../context/ArenaContext';

export function ToastViewport() {
  const { toasts, dismissToast } = useArena();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-20 md:bottom-6 right-4 z-[80] flex flex-col gap-2.5 w-[min(360px,calc(100vw-2rem))]"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.tone === 'success'
            ? CheckCircle2
            : toast.tone === 'danger'
              ? AlertCircle
              : toast.tone === 'warning'
                ? TriangleAlert
                : Info;

        const toneColor =
          toast.tone === 'success'
            ? 'text-[#22C55E]'
            : toast.tone === 'danger'
              ? 'text-[#EF4444]'
              : toast.tone === 'warning'
                ? 'text-amber-400'
                : 'text-[#22D3EE]';

        return (
          <div
            key={toast.id}
            role="status"
            className="arena-glass rounded-xl px-4 py-3 shadow-xl flex items-start gap-3"
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${toneColor}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink leading-snug">{toast.title}</p>
              {toast.message && <p className="text-xs text-muted mt-0.5 leading-relaxed">{toast.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label={`Dismiss ${toast.title}`}
              className="p-1 text-muted hover:text-ink rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
