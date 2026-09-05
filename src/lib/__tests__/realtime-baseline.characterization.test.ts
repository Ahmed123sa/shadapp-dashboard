import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Characterization test — Stage 0 of REALTIME_PLAN.md.
 *
 * Pins the CURRENT polling configuration and the CURRENT shape of
 * `subscribeToWorkspace` in source, so later stages change these values
 * deliberately (updating this test in the same commit) instead of silently.
 * Source-level assertions are used instead of runtime timer mocking because
 * the values here are static config, not behavior worth exercising through
 * fake timers + TanStack Query's own polling internals.
 *
 * Stage-by-stage, this file is expected to change:
 * - Stage 2 (done) added onWorkspaceStatusChanged/onPaymentStatusChanged to
 *   subscribeToWorkspace's callback type — the echo.ts assertion below now
 *   requires all four callbacks instead of forbidding the last two.
 * - Stage 3 (done) migrated client-dashboard/page.tsx onto useWorkspace +
 *   useWorkspaceRealtime and removed its 10s poll entirely — the assertion
 *   below now checks the opposite of what it originally pinned (subscribes,
 *   no 10s setInterval left in the page's own source).
 * - Stage 4 widens the 30s/60s refetchIntervals (usePayments/useChat) to a
 *   5-minute safety net — update those interval assertions then.
 */

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'src', relativePath), 'utf-8');
}

describe('realtime baseline (pre-Stage-1)', () => {
  it('usePayments polls every 30s', () => {
    const src = readSource('hooks/queries/usePayments.ts');
    expect(src).toMatch(/POLL_INTERVAL_MS\s*=\s*30000/);
  });

  it('useChat polls every 60s', () => {
    const src = readSource('hooks/queries/useChat.ts');
    expect(src).toMatch(/POLL_INTERVAL_MS\s*=\s*60000/);
  });

  it('NotificationBell polls every 300s (5 min)', () => {
    const src = readSource('components/NotificationBell.tsx');
    expect(src).toMatch(/setInterval\(\s*load\s*,\s*300000\s*\)/);
  });

  it('client-dashboard page subscribes to realtime events and no longer polls the workspace every 10s', () => {
    const src = readSource('app/client-dashboard/page.tsx');
    expect(src).not.toMatch(/setInterval\(\s*\(\)\s*=>\s*\{[\s\S]*?\}, 10000\)/);
    expect(src).toContain('useWorkspaceRealtime');
  });

  it('subscribeToWorkspace supports all four realtime callbacks as of Stage 2', () => {
    const src = readSource('lib/echo.ts');
    expect(src).toContain('onMessageSent?:');
    expect(src).toContain('onContractStatusChanged?:');
    expect(src).toContain('onWorkspaceStatusChanged?:');
    expect(src).toContain('onPaymentStatusChanged?:');
  });
});
