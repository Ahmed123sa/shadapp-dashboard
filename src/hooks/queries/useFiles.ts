'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { FileEntry, PaymentProofFile, DocumentDefinition } from '@/types';

// FilesTab (staff view) and ClientFiles (client view) both hit the exact
// same `/workspaces/:id/files` endpoint and render the same three lists, so
// they share this one cache entry/key rather than each fetching their own
// copy — an upload or review from either surface (once both are migrated)
// invalidates/patches data the other is already looking at.
export const fileKeys = {
  workspace: (wsId: number) => ['files', 'workspace', wsId] as const,
};

type WorkspaceFilesData = {
  files: FileEntry[];
  paymentFiles: PaymentProofFile[];
  definitions: DocumentDefinition[];
};

async function fetchWorkspaceFiles(wsId: number): Promise<WorkspaceFilesData> {
  const { data } = await api.get(`/workspaces/${wsId}/files`);
  return {
    files: data.files || [],
    paymentFiles: data.paymentFiles || [],
    definitions: data.definitions || [],
  };
}

export function useWorkspaceFiles(wsId: number) {
  return useQuery({
    queryKey: fileKeys.workspace(wsId),
    queryFn: () => fetchWorkspaceFiles(wsId),
  });
}

export function useUploadFile(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) =>
      api.post(`/workspaces/${wsId}/files`, form).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.file) return;
      queryClient.setQueryData<WorkspaceFilesData | undefined>(fileKeys.workspace(wsId), (old) =>
        old ? { ...old, files: [...old.files, data.file] } : old
      );
    },
  });
}

export function useAddDocumentDefinition(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post(`/workspaces/${wsId}/document-definitions`, { name }).then((r) => r.data),
    onSuccess: (data) => {
      if (!data?.definition) return;
      queryClient.setQueryData<WorkspaceFilesData | undefined>(fileKeys.workspace(wsId), (old) =>
        old ? { ...old, definitions: [...old.definitions, data.definition] } : old
      );
    },
  });
}

export function useReviewFile(wsId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fid, action, rejection_reason }: { fid: number; action: string; rejection_reason?: string }) => {
      const body: { action: string; rejection_reason?: string } = { action };
      if (rejection_reason) body.rejection_reason = rejection_reason;
      return api.post(`/files/${fid}/review`, body).then((r) => r.data);
    },
    onSuccess: (data) => {
      if (!data?.file) return;
      queryClient.setQueryData<WorkspaceFilesData | undefined>(fileKeys.workspace(wsId), (old) =>
        old ? { ...old, files: old.files.map((f) => (f.id === data.file.id ? data.file : f)) } : old
      );
    },
  });
}
