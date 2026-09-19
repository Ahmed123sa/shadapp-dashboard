'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export const subUserKeys = {
  detail: (id: number | string) => ['sub-users', 'detail', id] as const,
};

export type SubUserPermissions = Record<string, boolean>;

async function fetchSubUserPermissions(id: number | string): Promise<SubUserPermissions> {
  const { data } = await api.get(`/sub-users/${id}`);
  return data.sub_user?.permissions || {};
}

// SUBUSER_PLAN.md §5.3 — the sub_user record client-auth.ts caches in
// localStorage is written once at login and never refreshed, so a
// permission the primary client revokes mid-session stays visible to the
// sub-user as a clickable tab until they log out and back in (every action
// behind it already 403s server-side per Phase 2, but the tab itself
// shouldn't be there either). client-dashboard/page.tsx calls this on every
// load and uses its result — falling back to the cached localStorage copy
// only while this is still loading — for the tab filter, and syncs the
// result back into localStorage via syncSubUserPermissions() so any other
// reader of getSubUser() also sees the current permissions.
export function useSubUserPermissions(id: number | string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: subUserKeys.detail(id ?? ''),
    queryFn: () => fetchSubUserPermissions(id as number | string),
    enabled: (options?.enabled ?? true) && id !== undefined,
  });
}

export const permissionKeyKeys = {
  all: ['sub-user-permission-keys'] as const,
};

async function fetchPermissionKeys(): Promise<string[]> {
  const { data } = await api.get('/sub-user-permissions');
  return data.permissions || [];
}

// SUBUSER_PLAN.md §6.1 — the 11 permission keys used to be typed out by hand
// here (well, in ClientSubUsers.tsx) and again in SubUser::PERMISSION_KEYS on
// the backend and in subusers_page.dart on mobile, so adding or renaming one
// meant remembering all three call sites. This now reads the list straight
// from the backend's single source. The list is effectively static within a
// deployed version of the app, so it's fetched once and never refetched.
export function usePermissionKeys() {
  return useQuery({
    queryKey: permissionKeyKeys.all,
    queryFn: fetchPermissionKeys,
    staleTime: Infinity,
  });
}
