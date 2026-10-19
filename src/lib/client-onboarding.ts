/**
 * Client onboarding stage rules — a line-for-line port of `_computeStage()`
 * in shadapp-mobile/lib/features/onboarding/client_onboarding_screen.dart.
 * Keep the two in sync: the same client must land on the same stage on web
 * and mobile.
 *
 * Stages: 0 sign · 1 waiting for contract · 2 review contract ·
 * 3 waiting for company · 4 payment · 5 payment review · 6 edit requested.
 */

export type OnboardingStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface StageClient {
  signed_at?: string | null;
}

interface StageWorkspace {
  status?: string;
  contracts?: Array<{ status?: string }> | null;
  payments?: Array<{ status?: string }> | null;
}

/** Index (0-5) of the highlighted step in the six-step track, per stage. */
export const STAGE_TO_STEP: readonly number[] = [0, 1, 2, 3, 4, 5, 2];

export function computeOnboardingStage(
  client: StageClient | null | undefined,
  workspace: StageWorkspace | null | undefined,
): OnboardingStage {
  if (!client || !workspace) return 0;
  const contracts = workspace.contracts ?? [];
  const payments = workspace.payments ?? [];
  const hasContract = (...statuses: string[]) =>
    contracts.some((c) => !!c && statuses.includes(c.status ?? ''));

  if (payments.some((p) => !!p && (p.status === 'approved' || p.status === 'pending'))) return 5;
  if (hasContract('completed', 'archived', 'company_approved')) return 4;
  if (hasContract('client_approved')) return 3;
  if (hasContract('sent')) return client.signed_at ? 2 : 0;
  if (hasContract('edit_requested')) return 6;
  if (client.signed_at) return 1;
  return 0;
}

/** The workspace is live: the client leaves onboarding for the workspace UI. */
export function isWorkspaceActive(workspace: StageWorkspace | null | undefined): boolean {
  return workspace?.status === 'active';
}

export function stageToStep(stage: number): number {
  return STAGE_TO_STEP[stage] ?? 0;
}
