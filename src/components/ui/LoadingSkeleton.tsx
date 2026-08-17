import { useTranslations } from 'next-intl';

export function LoadingSkeleton({ message = '' }: { message?: string }) {
  const t = useTranslations('dashboard');
  return (
    <div className="text-center py-8 text-[var(--color-text-disabled)]">{message || t('client_loading')}</div>
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--color-card-border)] rounded ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-8 w-16" />
            <SkeletonBlock className="h-2.5 w-32" />
          </div>
        ))}
      </div>
      <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
        <SkeletonBlock className="h-3 w-40" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonBlock className="h-8 w-8 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <SkeletonBlock className="h-3 w-48" />
              <SkeletonBlock className="h-2 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-7 w-12" />
            <SkeletonBlock className="h-2.5 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
            <SkeletonBlock className="h-3 w-36" />
            <SkeletonBlock className="h-40 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-4 pb-2 border-b border-[var(--border)]">
        {[...Array(4)].map((_, i) => (
          <SkeletonBlock key={i} className="h-3 flex-1" />
        ))}
      </div>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-1.5">
          {[...Array(4)].map((_, j) => (
            <SkeletonBlock key={j} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
