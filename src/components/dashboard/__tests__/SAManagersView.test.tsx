import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { useTranslations, useLocale } from 'next-intl';
import { renderWithIntl } from '@/test/render';
import api from '@/lib/api';
import SAManagersView from '../SAManagersView';
import type { DashboardStats, PendingApprovalsResponse } from '@/types';
import type { Contract } from '@/components/dashboard/types';

// 26 Sept 2026 — SAManagersView now renders PendingApprovalsPanel (ك2),
// which calls GET /dashboard/pending-approvals on its own. Every test below
// mocks it to an empty response by default so that request doesn't reject
// unhandled; the panel's own behaviour is covered by
// PendingApprovalsPanel.test.tsx.
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

// 24 Sept 2026 — this view's four summary cards (total clients, active
// contracts, monthly revenue, pending approvals) used to be computed here
// from managers/allContracts/allPayments/pendingApprovals props, each
// capped at 30-100 rows the parent had already fetched — wrong once real
// data grew past that cap. The revenue card specifically also summed every
// currency into one meaningless figure with no date filter at all despite
// its "Monthly Revenue" label, and the approvals card counted only approval
// requests while the badge that opens the same screen also counts pending
// contracts and payments. All four now come from GET /dashboard/stats,
// mocked below instead of computed from prop arrays.

function Harness({ allContracts = [] }: { allContracts?: Contract[] } = {}) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  return (
    <SAManagersView
      t={t} locale={locale} managers={[]} allContracts={allContracts} allPayments={[]}
      allMeetings={[]} pendingApprovals={[]} unreadCount={0}
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

/** The revenue card's value, isolated from the rest of the dashboard. */
function revenueCard() {
  return screen.getByText('Monthly Revenue').closest('div')!.parentElement!;
}

describe('SAManagersView', () => {
  it('shows total clients, active contracts and the unified pending-approvals total from the server', async () => {
    mock.onGet('/dashboard/stats').reply(200, statsResponse({
      clients: { total: 42 },
      contracts: { active: 18, awaiting_client: 5 },
      // Deliberately not 8 (3+5) — proves this reads approvals.total, the
      // same figure the approvals badge uses, not a client-side re-count.
      approvals: { pending_requests: 3, pending_contracts: 5, pending_payments: 7, total: 15 },
    }));
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('shows 0 for a brand new company with nothing yet, not a stale number', async () => {
    mock.onGet('/dashboard/stats').reply(200, statsResponse());
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getAllByText('0').length).toBeGreaterThan(0));
  });

  // pending-approvals-plan.md ن6/ك4 — this card used to be a plain
  // non-interactive div with no link at all. "Pending Approvals" also
  // labels the PendingApprovalsPanel's own header (same translation key),
  // so this looks specifically for the copy that sits inside an <a> — only
  // the stat card is a link.
  it('links the pending-approvals card to the full list', async () => {
    mock.onGet('/dashboard/stats').reply(200, statsResponse());
    renderWithIntl(<Harness />);

    await waitFor(() => {
      const cardLabel = screen.getAllByText('Pending Approvals').find((el) => el.closest('a'));
      expect(cardLabel?.closest('a')).toHaveAttribute('href', '/dashboard?view=approvals');
    });
  });

  describe('revenue card', () => {
    // The headline bug: different currencies are not addable, and this
    // system holds no exchange rates, so there is no honest single figure.
    it('keeps each currency on its own line instead of summing them', async () => {
      mock.onGet('/dashboard/stats').reply(200, statsResponse({
        revenue_this_month: { SAR: 1000, USD: 500 },
      }));
      renderWithIntl(<Harness />);

      await waitFor(() => expect(screen.getByText('1,000')).toBeInTheDocument());
      const card = within(revenueCard());
      expect(card.getByText('SAR')).toBeInTheDocument();
      expect(card.getByText('USD')).toBeInTheDocument();
      expect(card.getByText('500')).toBeInTheDocument();
      // The old behaviour: 1000 + 500 rendered as a single "1,500".
      expect(card.queryByText('1,500')).not.toBeInTheDocument();
    });

    it('shows a dash rather than a zero when there is nothing this month', async () => {
      mock.onGet('/dashboard/stats').reply(200, statsResponse({ revenue_this_month: {} }));
      renderWithIntl(<Harness />);

      await waitFor(() => expect(within(revenueCard()).getByText('—')).toBeInTheDocument());
    });
  });

  // pending-approvals-plan.md ن4/س4 — 'sent' and 'client_approved' contracts
  // used to appear a second time here ("Contract X sent" / "Client X
  // approved the contract"), duplicating exactly what the new
  // PendingApprovalsPanel above already lists (awaiting_client/awaiting_you).
  // A contract now only shows up in this feed once it's actually resolved.
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
