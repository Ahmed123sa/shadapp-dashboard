'use client';

import Link from 'next/link';

interface DashboardStatCardProps {
  label: string;
  // ReactNode, not just number|string: the revenue card renders one line
  // per currency (amounts in different currencies cannot be summed into a
  // single figure, and this system has no exchange rates). Every other
  // caller still passes a plain number or string.
  value: React.ReactNode;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  color?: 'default' | 'gold' | 'crimson' | 'red';
  subtitle?: string;
  // pending-approvals-plan.md ك4 — the "Pending Approvals" card links to
  // the full ?view=approvals list (ن6: it used to be a plain non-interactive
  // div with no href/onClick at all). Optional so every other card, which
  // has nowhere sensible to link to, is unaffected.
  href?: string;
}

// بند 1.2: `val` بيتلوّن نص كبير (24px bold) فوق --color-card-bg الغامق، فلازم
// يستخدم --color-primary-light (محسوب عشان يعدّي تباين WCAG) مش --color-primary
// الخام نفسه (فاشل كنص، تباينه 2.00:1 بس فوق الخلفية دي). `bar` مجرد خط زخرفي
// (خلفية) فمش محتاج نفس القيد. نفس المبدأ اتطبّق على `gold.val` (دفعة 4.5/2):
// --color-gold الخام فاشل كنص فوق --color-card-bg في الثيم الفاتح.
const colorMap = {
  default: { val: '', bar: 'var(--color-primary)' },
  gold: { val: 'var(--color-gold-text)', bar: 'var(--color-gold)' },
  crimson: { val: 'var(--color-primary-light)', bar: 'var(--color-primary)' },
  red: { val: 'var(--color-red-accent)', bar: 'var(--color-red-accent)' },
};

export default function DashboardStatCard({ label, value, icon, color = 'default', subtitle, href }: DashboardStatCardProps) {
  const c = colorMap[color] || colorMap.default;
  const Icon = icon;
  const className = 'bg-[var(--color-card-bg)] border border-[var(--border)] rounded-xl p-3.5 stat-card-hover block';
  const content = (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)]">{label}</span>
        <div className="w-7 h-7 rounded-lg bg-[var(--color-gold-soft)] flex items-center justify-center"><Icon size={16} strokeWidth={1.5} /></div>
      </div>
      <div className="text-[length:var(--fs-6)] font-bold font-display" style={{ color: c.val || undefined }}>
        {value}
      </div>
      <div className="h-[2.5px] w-[45%] rounded-[3px] mt-2" style={{ background: c.bar }} />
      {subtitle && <div className="text-[length:var(--fs-1)] text-[var(--color-text-secondary)] mt-1">{subtitle}</div>}
    </>
  );

  if (href) {
    return <Link href={href} className={className}>{content}</Link>;
  }
  return <div className={className}>{content}</div>;
}
