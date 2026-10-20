'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { isStaffMember } from '@/lib/permissions';
import { allStaffPermissions, normalizeStaffPermissions, type StaffPermissions } from '@/lib/staff-permissions';

// What the signed-in company staff member may do on ONE client (PLAN_2 ف٥).
// Comes from GET /workspaces/{ws} → `my_staff_permissions` (null = everything).
// Anyone who is not company staff is not restricted, so no request is made.
// While loading nothing is hidden — the backend refuses what is not allowed.
export const staffPermissionsKey = (wsId: number) => ['workspaces', 'staff-permissions', wsId] as const;

export function useStaffPermissions(wsId: number | undefined): StaffPermissions {
  const staff = isStaffMember(getUser());
  const query = useQuery({
    queryKey: staffPermissionsKey(wsId ?? 0),
    queryFn: async () => {
      const { data } = await api.get(`/workspaces/${wsId}`);
      return normalizeStaffPermissions(data.workspace?.my_staff_permissions);
    },
    enabled: staff && !!wsId,
  });
  if (!staff) return allStaffPermissions();
  return query.data ?? allStaffPermissions();
}
