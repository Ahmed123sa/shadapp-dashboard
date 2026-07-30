export function EmptyState({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="text-center py-12">
      <p className="text-zinc-400 text-sm">{message}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
