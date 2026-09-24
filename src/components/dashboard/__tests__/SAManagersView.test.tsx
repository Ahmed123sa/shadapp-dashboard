import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { useTranslations, useLocale } from 'next-intl';
import { renderWithIntl } from '@/test/render';
import api from '@/lib/api';
import SAManagersView from '../SAManagersView';
import type { DashboardStats } from '@/types';

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

function Harness() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  return (
    <SAManagersView
      t={t} locale={locale} managers={[]} allContracts={[]} allPayments={[]}
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
});
