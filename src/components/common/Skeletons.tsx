export function FullScreenLoader({ label = 'Connecting to BWB ARENA...' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4 px-6">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-xl border-2 border-[#8B5CF6]/25" />
        <div className="absolute inset-0 rounded-xl border-2 border-t-[#22D3EE] border-r-[#8B5CF6] border-b-transparent border-l-transparent animate-spin" />
      </div>
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}

export function CardRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading items">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="arena-surface rounded-2xl p-4 animate-pulse">
          <div className="h-32 rounded-xl bg-white/5 mb-4" />
          <div className="h-4 w-2/3 rounded bg-white/10 mb-2" />
          <div className="h-3 w-full rounded bg-white/5 mb-1.5" />
          <div className="h-3 w-4/5 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="Loading rankings">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3.5 px-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-28 rounded bg-white/10" />
              <div className="h-2.5 w-20 rounded bg-white/5" />
            </div>
          </div>
          <div className="h-3.5 w-16 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}
