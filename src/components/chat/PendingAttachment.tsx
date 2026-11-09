'use client';

import { useTranslations } from 'next-intl';
import { Paperclip, X } from 'lucide-react';
import { formatFileSize } from '@/lib/client-format';

// The file picked in a chat composer, shown before it is sent so it can be
// checked or taken back. Without it the only sign was a clipped name beside the
// input, with no way to remove the file short of sending it.
export default function PendingAttachment({ file, onRemove }: { file: File; onRemove: () => void }) {
  const t = useTranslations('dashboard');
  const size = formatFileSize(file.size);

  return (
    <div
      data-testid="pending-attachment"
      className="flex items-center gap-2 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-input-fill)] px-3 py-2 text-xs text-[var(--color-foreground)]"
    >
      <Paperclip size={14} strokeWidth={1.5} className="shrink-0 text-[var(--color-gold-text)]" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
      {size && <span className="shrink-0 text-[var(--color-text-secondary)]">{size}</span>}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('remove_attachment')}
        title={t('remove_attachment')}
        className="shrink-0 rounded p-1 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-gold-text)] active:opacity-70"
      >
        <X size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
