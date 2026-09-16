'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DataExport } from '@/types';

export const dataExportKeys = {
  list: () => ['data-exports', 'list'] as const,
};

// Only the first page (20 rows, newest first — DataExportController::index's
// own default) is fetched: this is an occasional admin/manager action, not a
// high-volume list, and DATA_SAFETY_PLAN.md §3.6 only asks for "a table of
// past requests", not pagination controls.
async function fetchDataExports(): Promise<DataExport[]> {
  const { data } = await api.get('/data-exports');
  return data.exports?.data || data.exports || [];
}

// The archive is built by a background queue job (App\Jobs\GenerateDataExport,
// DATA_SAFETY_PLAN.md §3.5.2) — nothing pushes a "finished" event into this
// list specifically (only the notification bell gets one, via
// DataExportReadyNotification). Polling every 4s while a row is still
// pending/processing is what turns "refresh the page yourself" into "the
// status flips on its own" without adding a permanent poll once every
// request already settled into ready/failed.
const ACTIVE_POLL_MS = 4000;

export function useDataExports() {
  return useQuery({
    queryKey: dataExportKeys.list(),
    queryFn: fetchDataExports,
    refetchInterval: (query) => {
      const rows = query.state.data;
      const hasActive = rows?.some((row) => row.status === 'pending' || row.status === 'processing');
      return hasActive ? ACTIVE_POLL_MS : false;
    },
  });
}

export type RequestDataExportPayload = {
  scope: 'system' | 'manager' | 'client';
  scope_id?: number | string;
};

export function useRequestDataExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestDataExportPayload) => api.post('/data-exports', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dataExportKeys.list() });
    },
  });
}
