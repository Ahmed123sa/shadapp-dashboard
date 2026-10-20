// Per-client permissions of a company staff member (PLAN_2_MANAGER_TEAMS.md ق٣).
// Mirrors App\Models\User::STAFF_PERMISSION_KEYS on the backend, which stays
// the authority — this is only the shape the screens work with.

export const STAFF_PERMISSION_KEYS = [
  'can_view_chat', 'can_send_chat',
  'can_view_approvals', 'can_request_approvals',
  'can_view_meetings', 'can_join_meetings',
] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];
export type StaffPermissions = Record<StaffPermissionKey, boolean>;

/** One group of the drawer / the chips: a "see" switch and the action under it. */
export const STAFF_PERMISSION_GROUPS = [
  { id: 'chat', view: 'can_view_chat', act: 'can_send_chat' },
  { id: 'approvals', view: 'can_view_approvals', act: 'can_request_approvals' },
  { id: 'meetings', view: 'can_view_meetings', act: 'can_join_meetings' },
] as const satisfies ReadonlyArray<{ id: string; view: StaffPermissionKey; act: StaffPermissionKey }>;

export const allStaffPermissions = (): StaffPermissions =>
  Object.fromEntries(STAFF_PERMISSION_KEYS.map((k) => [k, true])) as StaffPermissions;

/** Fills missing keys with `true` and switches an action off when its "see" is off. */
export function normalizeStaffPermissions(input?: Partial<StaffPermissions> | null): StaffPermissions {
  const map = { ...allStaffPermissions(), ...(input || {}) } as StaffPermissions;
  for (const g of STAFF_PERMISSION_GROUPS) {
    if (!map[g.view]) map[g.act] = false;
  }
  return map;
}

/** Set one key and keep the dependency rule (turning "see" off turns its action off). */
export function setStaffPermission(map: StaffPermissions, key: StaffPermissionKey, value: boolean): StaffPermissions {
  return normalizeStaffPermissions({ ...map, [key]: value });
}
