import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { useTranslations, useLocale } from 'next-intl';
import { renderWithIntl } from '@/test/render';
import api from '@/lib/api';
import AMView from '../AMView';
import type { DashboardStats } from '@/types';

// AMView calls useRouter() itself (for the client-row click handler) — a
// real Next.js app router isn't mounted under renderWithIntl, so this needs
// stubbing the same way src/app/dashboard/__tests__/page.test.tsx does.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// 24 Sept 2026 — this account manager dashboard's four summary cards (my
// clients, active contracts + "awaiting response" subtitle, pending
// payments) used to be computed here from the clients/allContracts/
// allPayments props, each capped at the first 30-100 rows the parent had
// already fetched — so a manager with more clients or contracts than that
// cap saw an undercount that never grew past it. All three now come from
// GET /dashboard/stats, mocked below instead of computed from prop arrays.

function Harness() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  return (
    <AMView
      t={t} locale={locale} clients={[]} allContracts={[]} allPayments={[]}
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
});

afterEach(() => {
  mock.restore();
});

describe('AMView', () => {
  // The actual bug this replaces: with 35 real contracts, the old
  // client-side filter over a 100-row-capped list still worked here, but a
  // manager with more than that many contracts would have silently seen an
  // undercount that could never grow past the cap. A server COUNT has none.
  it('shows my clients, active contracts and pending payments from the server', async () => {
    mock.onGet('/dashboard/stats').reply(200, statsResponse({
      clients: { total: 12 },
      contracts: { active: 35, awaiting_client: 4 },
      payments: { pending: 6 },
    }));
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
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
});
