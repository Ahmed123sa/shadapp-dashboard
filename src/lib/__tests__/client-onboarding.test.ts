import { describe, it, expect } from 'vitest';
import {
  computeOnboardingStage,
  isWorkspaceActive,
  resolveOnboardingStage,
  stageToStep,
} from '../client-onboarding';

const signed = { signed_at: '2026-10-01T10:00:00Z' };
const unsigned = { signed_at: null };
const ws = (contracts: string[] = [], payments: string[] = []) => ({
  contracts: contracts.map((status) => ({ status })),
  payments: payments.map((status) => ({ status })),
});

describe('computeOnboardingStage (mirrors mobile _computeStage)', () => {
  it('is 0 without a client or a workspace', () => {
    expect(computeOnboardingStage(null, ws())).toBe(0);
    expect(computeOnboardingStage(signed, null)).toBe(0);
    expect(computeOnboardingStage(undefined, undefined)).toBe(0);
  });

  it('is 0 for an unsigned client with nothing sent', () => {
    expect(computeOnboardingStage(unsigned, ws())).toBe(0);
  });

  it('is 1 once signed and no contract has been sent', () => {
    expect(computeOnboardingStage(signed, ws())).toBe(1);
  });

  it('a sent contract: 2 if signed, 0 if not', () => {
    expect(computeOnboardingStage(signed, ws(['sent']))).toBe(2);
    expect(computeOnboardingStage(unsigned, ws(['sent']))).toBe(0);
  });

  it('is 6 for edit_requested', () => {
    expect(computeOnboardingStage(signed, ws(['edit_requested']))).toBe(6);
  });

  it('sent wins over edit_requested', () => {
    expect(computeOnboardingStage(signed, ws(['edit_requested', 'sent']))).toBe(2);
  });

  it('is 3 once the client approved', () => {
    expect(computeOnboardingStage(signed, ws(['client_approved']))).toBe(3);
  });

  it.each(['company_approved', 'completed', 'archived'])('is 4 for %s', (s) => {
    expect(computeOnboardingStage(signed, ws([s]))).toBe(4);
  });

  it('company-side statuses win over client_approved', () => {
    expect(computeOnboardingStage(signed, ws(['client_approved', 'company_approved']))).toBe(4);
  });

  it.each(['approved', 'pending'])('is 5 when a payment is %s', (s) => {
    expect(computeOnboardingStage(signed, ws(['company_approved'], [s]))).toBe(5);
  });

  it('rejected / scheduled payments do not move to 5', () => {
    expect(computeOnboardingStage(signed, ws(['company_approved'], ['rejected', 'scheduled']))).toBe(4);
  });

  it('tolerates missing lists', () => {
    expect(computeOnboardingStage(signed, {})).toBe(1);
    expect(computeOnboardingStage(signed, { contracts: null, payments: null })).toBe(1);
  });
});

describe('stageToStep', () => {
  it('maps stages onto the six-step track, edit-requested stays on review', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(stageToStep)).toEqual([0, 1, 2, 3, 4, 5, 2]);
  });
  it('falls back to 0 for unknown stages', () => {
    expect(stageToStep(99)).toBe(0);
  });
});

describe('isWorkspaceActive', () => {
  it('only an active workspace leaves onboarding', () => {
    expect(isWorkspaceActive({ status: 'active' })).toBe(true);
    expect(isWorkspaceActive({ status: 'inactive' })).toBe(false);
    expect(isWorkspaceActive(null)).toBe(false);
    expect(isWorkspaceActive(undefined)).toBe(false);
  });
});

describe('resolveOnboardingStage (web)', () => {
  it('a signed client without a workspace row waits instead of re-signing', () => {
    expect(resolveOnboardingStage(signed, null)).toBe(1);
    expect(resolveOnboardingStage(unsigned, null)).toBe(0);
  });
  it('otherwise matches the mobile rule', () => {
    expect(resolveOnboardingStage(signed, ws(['sent']))).toBe(2);
    expect(resolveOnboardingStage(null, null)).toBe(0);
  });
});
