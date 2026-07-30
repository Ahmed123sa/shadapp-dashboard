'use client';

export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, variant = 'default' }: {
  open: boolean; title: string; message: string; confirmLabel: string; cancelLabel: string;
  onConfirm: () => void; onCancel: () => void; variant?: 'default' | 'danger';
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="bg-[var(--color-card)] border border-[var(--color-card-border)] p-6 max-w-sm w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="bg-[var(--color-input-fill)] text-[var(--color-text-secondary)] px-4 py-2 rounded-lg text-sm hover:bg-[var(--color-card-border)]">{cancelLabel}</button>
          <button onClick={onConfirm} className={`px-4 py-2 rounded-lg text-sm text-white ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
