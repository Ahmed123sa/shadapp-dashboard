import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { useTranslations, useLocale } from 'next-intl';
import { renderWithIntl } from '@/test/render';
import api from '@/lib/api';
import AMView from '../AMView';
import type { DashboardStats, PendingApprovalsResponse } from '@/types';
import type { Contract } from '@/components/dashboard/types';

// AMView calls useRouter() itself (for the client-row click handler) — a
// real Next.js app router isn't mounted under renderWithIntl, so this needs
// stubbing the same way src/app/dashboard/__tests__/page.test.tsx does.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// 26 Sept 2026 — AMView now renders PendingApprovalsPanel (ك3), which calls
// GET /dashboard/pending-approvals and subscribeToNotifications on its own.
// Mocked the same way SAManagersView.test.tsx mocks both for the same panel.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToNotifications: vi.fn(() => null),
}));

function emptyPendingApprovals(): PendingApprovalsResponse {
  return {
    awaiting_you: { contracts: [], payments: [] },
    awaiting_client: { contracts: [], approvals: [] },
    counts: { pending_requests: 0, pending_contracts: 0, pending_payments: 0, total: 0 },
  };
}

// 24 Sept 2026 — this account manager dashboard's four summary cards (my
// clients, active contracts + "awaiting response" subtitle, pending
// payments) used to be computed here from the clients/allContracts/
// allPayments props, each capped at the first 30-100 rows the parent had
// already fetched — so a manager with more clients or contracts than that
// cap saw an undercount that never grew past it. All three now come from
// GET /dashboard/stats, mocked below instead of computed from prop arrays.

function Harness({ allContracts = [] }: { allContracts?: Contract[] } = {}) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  return (
    <AMView
      t={t} locale={locale} clients={[]} allContracts={allContracts} allPayments={[]}
      allMeetings={[]} unreadCount={2} unreadClientsCount={1}
    />
  );
}

function statsResponse(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    clients: { total: 0 },
    contracts: { active: 0, awaiting_client: 0 },
    payments: { pending: 0 },
    approvals: { pending_requests: 0, pending_contracts: 0, pending_payments: 0, total: 0 },
    revenue_this_month: {},
    period: { month: '2026-09', timezone: 'Africa/Cairo' },
    ...overrides,
  };
}

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
  mock.onGet('/dashboard/pending-approvals').reply(200, emptyPendingApprovals());
});

afterEach(() => {
  mock.restore();
});

describe('AMView', () => {
  // The actual bug this replaces: with 35 real contracts, the old
  // client-side filter over a 100-row-capped list still worked here, but a
  // manager with more than that many contracts would have silently seen an
  // undercount that could never grow past the cap. A server COUNT has none.
  it('shows my clients and active contracts from the server', async () => {
    mock.onGet('/dashboard/stats').reply(200, statsResponse({
      clients: { total: 12 },
      contracts: { active: 35, awaiting_client: 4 },
    }));
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    expect(screen.getByText('35')).toBeInTheDocument();
  });

  // plans/pending-approvals-fixes-plan.md ح٤ — replaces the old unlinked
  // "Pending Payments" card with the same card SAManagersView has, read from
  // the same query as PendingApprovalsPanel (ح٢), so an account manager can
  // always reach the full list in one click, even at zero.
  it('shows a pending-approvals card from the panel\'s own source, linked to the full list', async () => {
    mock.onGet('/dashboard/stats').reply(200, statsResponse({
      payments: { pending: 6 },
      approvals: { pending_requests: 0, pending_contracts: 0, pending_payments: 0, total: 99 },
    }));
    const pending = emptyPendingApprovals();
    pending.counts = { pending_requests: 1, pending_contracts: 2, pending_payments: 4, total: 7 };
    mock.onGet('/dashboard/pending-approvals').reply(200, pending);
    renderWithIntl(<Harness />);

    const cardLabel = await screen.findByText('Pending Approvals', { selector: 'a span' });
    expect(cardLabel.closest('a')).toHaveAttribute('href', '/dashboard?view=approvals');
    await waitFor(() => expect(within(cardLabel.closest('a')!).getByText('7')).toBeInTheDocument());
    expect(screen.queryByText('99')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending Payments')).not.toBeInTheDocument();
  });

  it('keeps the pending-approvals card reachable when nothing is pending', async () => {
    mock.onGet('/dashboard/stats').reply(200, statsResponse());
    renderWithIntl(<Harness />);

    const cardLabel = await screen.findByText('Pending Approvals', { selector: 'a span' });
    expect(cardLabel.closest('a')).toHaveAttribute('href', '/dashboard?view=approvals');
  });

  it('shows the awaiting-response count from contracts.awaiting_client, not a re-filtered list', async () => {
    mock.onGet('/dashboard/stats').reply(200, statsResponse({
      contracts: { active: 9, awaiting_client: 4 },
    }));
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument());
    expect(screen.getByText('4 awaiting response')).toBeInTheDocument();
  });

  it('shows 0 for a brand new manager with nothing yet, not a stale number', async () => {
    mock.onGet('/dashboard/stats').reply(200, statsResponse());
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getAllByText('0').length).toBeGreaterThan(0));
  });

  // pending-approvals-plan.md ن2/ن4/س4 — the AM home never had a pending-
  // approvals list at all before ك3, even though its badge already counted
  // the same items. Now that PendingApprovalsPanel is here, 'sent'/
  // 'client_approved' contracts must not also duplicate into Recent Activity.
  describe('recent activity feed', () => {
    it('no longer duplicates pending contracts already shown in the approvals panel', async () => {
      mock.onGet('/dashboard/stats').reply(200, statsResponse());
      const contracts: Contract[] = [
        { id: 1, title: 'Sent Deal', status: 'sent', value: '100', currency: 'SAR', created_at: new Date().toISOString(), workspace: { id: 1, client: { id: 1, company_name: 'Sent Co' } } },
        { id: 2, title: 'Client Approved Deal', status: 'client_approved', value: '100', currency: 'SAR', created_at: new Date().toISOString(), workspace: { id: 2, client: { id: 2, company_name: 'Approved Co' } } },
      ];
      renderWithIntl(<Harness allContracts={contracts} />);

      await waitFor(() => expect(screen.getByText('Recent Activity')).toBeInTheDocument());
      expect(screen.queryByText(/Sent Co/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Approved Co/)).not.toBeInTheDocument();
      expect(screen.queryByText('No activities')).toBeInTheDocument();
    });

    it('still shows a contract once the company itself has approved it', async () => {
      mock.onGet('/dashboard/stats').reply(200, statsResponse());
      const contracts: Contract[] = [
        { id: 3, title: 'Done Deal', status: 'company_approved', value: '100', currency: 'SAR', created_at: new Date().toISOString(), workspace: { id: 3, client: { id: 3, company_name: 'Finished Co' } } },
      ];
      renderWithIntl(<Harness allContracts={contracts} />);

      await waitFor(() => expect(screen.getByText(/Finished Co/)).toBeInTheDocument());
    });
  });
});
