/**
 * The client workspace's six tabs. Keys are stable English slugs (they used to
 * be the Arabic labels, which broke `?tab=` links for English users).
 */

export type ClientTabKey = 'contracts' | 'payments' | 'chat' | 'approvals' | 'files' | 'meetings';

export interface ClientTabDef {
  key: ClientTabKey;
  /** Sub-user permission that unlocks the tab. */
  perm: string;
  /** Old Arabic key, still accepted in `?tab=` so existing links keep working. */
  legacy: string;
  /** Matching `badge-counts` field, if the API reports one. */
  badge?: 'contracts' | 'payments' | 'chat' | 'approvals' | 'files';
}

export const CLIENT_TABS: readonly ClientTabDef[] = [
  { key: 'contracts', perm: 'can_view_contracts', legacy: 'العقود', badge: 'contracts' },
  { key: 'payments', perm: 'can_view_payments', legacy: 'المدفوعات', badge: 'payments' },
  { key: 'chat', perm: 'can_chat', legacy: 'الشات', badge: 'chat' },
  { key: 'approvals', perm: 'can_view_approvals', legacy: 'الموافقات', badge: 'approvals' },
  { key: 'files', perm: 'can_view_files', legacy: 'الملفات', badge: 'files' },
  { key: 'meetings', perm: 'can_view_meetings', legacy: 'الاجتماعات' },
];

export function visibleClientTabs(has: (perm: string) => boolean): ClientTabDef[] {
  return CLIENT_TABS.filter((tab) => has(tab.perm));
}

/**
 * Maps a `?tab=` value to a tab key. Accepts the slug, the old Arabic key, or
 * a localized label (NotificationBell links use `dashboard.tab_*` labels).
 */
export function resolveTabParam(param: string | null | undefined, labels: Partial<Record<ClientTabKey, string[]>> = {}): ClientTabKey | null {
  if (!param) return null;
  const p = param.trim().toLowerCase();
  for (const tab of CLIENT_TABS) {
    if (tab.key === p || tab.legacy === param.trim()) return tab.key;
    if ((labels[tab.key] ?? []).some((l) => l.toLowerCase() === p)) return tab.key;
  }
  return null;
}
