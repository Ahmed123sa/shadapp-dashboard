'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClient, hasSubUserPermission, isClientAuthenticated, isSubUser } from '@/lib/client-auth';
import { CLIENT_TABS } from '@/lib/client-tabs';
import { useClient } from '@/hooks/queries/useClients';
import { useWorkspace } from '@/hooks/queries/useWorkspace';
import { useBadgeCounts } from '@/hooks/queries/useBadgeCounts';

/**
 * Shared gate for the signed-in client pages that sit next to the workspace
 * (team, signature, settings): redirects visitors who aren't logged in, keeps
 * assistants off owner-only pages, and — like the mobile app — keeps all of
 * them closed until the workspace is active.
 */
export function useClientPortalPage({ ownerOnly = false }: { ownerOnly?: boolean } = {}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const session = getClient();

  const { data: client } = useClient(session?.id ?? '', { enabled: !!session?.id });
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace(client?.workspace?.id);
  const { data: counts } = useBadgeCounts(true);

  useEffect(() => {
    setMounted(true);
    if (!isClientAuthenticated()) {
      router.push('/client-login');
    } else if (ownerOnly && isSubUser()) {
      router.replace('/client-dashboard');
    }
  }, [router, ownerOnly]);

  const workspaceKnown = !!client && !(client.workspace?.id && workspaceLoading);
  const wsActive = workspace?.status === 'active';

  useEffect(() => {
    if (workspaceKnown && !wsActive) router.replace('/client-dashboard');
  }, [workspaceKnown, wsActive, router]);

  const wsCount = CLIENT_TABS.reduce((sum, tab) => {
    if (!tab.badge) return sum;
    if (isSubUser() && !hasSubUserPermission(tab.perm)) return sum;
    return sum + (counts?.[tab.badge] ?? 0);
  }, 0);

  const blocked = ownerOnly && isSubUser();
  const ready = mounted && !!session && !!client && wsActive && !blocked;
  return { ready, session, client, workspace, wsCount };
}
