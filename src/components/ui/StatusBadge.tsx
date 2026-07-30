'use client';

const statusColors: Record<string, string> = {
  draft: 'bg-zinc-700/30 text-zinc-400',
  sent: 'bg-blue-900/30 text-blue-400',
  client_approved: 'bg-green-900/30 text-green-400',
  client_rejected: 'bg-red-900/30 text-red-400',
  edit_requested: 'bg-amber-900/30 text-amber-400',
  company_approved: 'bg-purple-900/30 text-purple-400',
  completed: 'bg-emerald-900/30 text-emerald-400',
  archived: 'bg-zinc-700/30 text-zinc-500',
  pending: 'bg-yellow-900/30 text-yellow-400',
  approved: 'bg-green-900/30 text-green-400',
  rejected: 'bg-red-900/30 text-red-400',
  active: 'bg-green-900/30 text-green-400',
  inactive: 'bg-zinc-700/30 text-zinc-500',
  scheduled: 'bg-blue-900/30 text-blue-400',
  cancelled: 'bg-red-900/30 text-red-400',
};

const statusLabels: Record<string, string> = {
  draft: 'مسودة', sent: 'مرسل',
  client_approved: 'موافقة العميل', client_rejected: 'رفض العميل',
  edit_requested: 'طلب تعديل',
  company_approved: 'موافقة الشركة', completed: 'مكتمل',
  archived: 'مؤرشف', pending: 'معلق',
  approved: 'مقبول', rejected: 'مرفوض',
  active: 'نشط', inactive: 'غير نشط',
  scheduled: 'مجدول', cancelled: 'ملغي',
};

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-zinc-700/30 text-zinc-400'} ${className}`}>
      {statusLabels[status] || status}
    </span>
  );
}
