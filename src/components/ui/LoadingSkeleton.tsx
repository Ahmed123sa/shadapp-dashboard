export function LoadingSkeleton({ message = 'جاري التحميل...' }: { message?: string }) {
  return (
    <div className="text-center py-8 text-[var(--color-text-disabled)]">{message}</div>
  );
}
