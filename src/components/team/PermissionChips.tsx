'use client';

import { useTranslations } from 'next-intl';
import { useUiStyle } from '@/lib/ui-style';
import { STAFF_PERMISSION_GROUPS, type StaffPermissions } from '@/lib/staff-permissions';

// What a staff member may do on one client, as chips: "Chat · view + send".
// A group that is off is struck through; with nothing on it says "No access".
// Shared by the Team page and the workspace Team tab (PLAN_2 ف٣/ف٤).

const GROUP_LABEL = { chat: 'mt_perm_chat', approvals: 'mt_perm_approvals', meetings: 'mt_perm_meetings' } as const;
const ACT_LABEL = { chat: 'mt_send', approvals: 'mt_request', meetings: 'mt_join' } as const;

export default function PermissionChips({ permissions }: { permissions: StaffPermissions }) {
  const t = useTranslations('dashboard');
  const luxe = useUiStyle() === 'luxe';

  const anyOn = STAFF_PERMISSION_GROUPS.some((g) => permissions[g.view]);
  if (!anyOn) {
    return <span className="text-xs text-[var(--color-text-secondary)]">{t('mt_none')}</span>;
  }

  const on = luxe
    ? 'lx-pc'
    : 'text-[11px] px-2 py-0.5 rounded-full border border-[var(--color-card-border)] text-[var(--color-text-secondary)] whitespace-nowrap';
  const off = luxe
    ? 'lx-pc lx-pc-off'
    : 'text-[11px] px-2 py-0.5 rounded-full border border-dashed border-[var(--color-card-border)] text-[var(--color-text-disabled)] line-through whitespace-nowrap';

  return (
    <div className="flex gap-1.5 flex-wrap" data-testid="permission-chips">
      {STAFF_PERMISSION_GROUPS.map((g) => {
        const label = t(GROUP_LABEL[g.id]);
        if (!permissions[g.view]) {
          return <span key={g.id} className={off} data-off="true">{label}</span>;
        }
        return (
          <span key={g.id} className={on}>
            {label} · {t('mt_view')}{permissions[g.act] ? ` + ${t(ACT_LABEL[g.id])}` : ''}
          </span>
        );
      })}
    </div>
  );
}
