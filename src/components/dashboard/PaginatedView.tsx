'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type ViewConfig<T> = {
  title: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  headers: string[];
  getLink: (item: T) => string;
  renderRow: (item: T, locale: string) => React.ReactNode;
};

export function PaginatedView<T extends { id: number | string }>({
  config,
  items,
  total,
  lastPage,
  page,
  onPrevPage,
  onNextPage,
  locale,
  apiLoading,
}: {
  config: ViewConfig<T> | null;
  items: T[];
  total: number;
  lastPage: number;
  page: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  locale: string;
  apiLoading: boolean;
}) {
  const router = useRouter();
  const t = useTranslations('dashboard');

  if (!config) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ minHeight: '640px' }}>
      <div className="p-5">
        <div className="bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <config.icon size={20} strokeWidth={1.5} />
              <span className="text-[12.5px] font-bold">{config.title}</span>
              <span className="text-[10px] bg-[var(--color-card-border)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full">{total}</span>
            </div>
            <Link href="/dashboard" className="text-[10.5px] text-[var(--color-gold)]">{t('paginated_back')}</Link>
          </div>
          {apiLoading ? (
            <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">{t('paginated_loading')}</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
              {t('paginated_no_data')}
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr>
                    {config.headers.map((h: string, i: number) => (
                      <th key={i} className="text-center text-[11px] text-[var(--color-text-secondary)] px-3.5 py-2.5 border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i: number) => (
                    <tr
                      key={item.id}
                      className="row-slide hover:bg-white/[0.025] cursor-pointer"
                      style={{ animationDelay: `${(i + 1) * 50}ms` }}
                      onClick={() => router.push(config.getLink(item))}
                    >
                      {config.renderRow(item, locale)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {lastPage > 1 && (
                <div className="flex items-center justify-center gap-2 py-3 border-t border-[var(--border)]">
                  <button
                    disabled={page <= 1}
                    onClick={(e) => { e.stopPropagation(); onPrevPage(); }}
                    className="px-3 py-1.5 rounded-lg text-[11px] border border-[var(--border)] text-[var(--color-text-secondary)] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('paginated_previous')}
                  </button>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    {page} / {lastPage}
                  </span>
                  <button
                    disabled={page >= lastPage}
                    onClick={(e) => { e.stopPropagation(); onNextPage(); }}
                    className="px-3 py-1.5 rounded-lg text-[11px] border border-[var(--border)] text-[var(--color-text-secondary)] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('paginated_next')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
