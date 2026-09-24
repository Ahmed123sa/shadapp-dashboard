import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { useTranslations, useLocale } from 'next-intl';
import { renderWithIntl } from '@/test/render';
import api from '@/lib/api';
import AMListView from '../AMListView';

// AMListView and PaginatedView both call useRouter() (row clicks navigate to
// the client) — a real Next.js app router isn't mounted under
// renderWithIntl, so this needs stubbing the same way
// src/app/dashboard/__tests__/page.test.tsx does.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// 24 Sept 2026 — server-side-stats-plan.md, W9. The contracts view
// (?view=contracts) used to render straight from an allContracts prop the
// parent had already capped at 100 rows with no real pagination: any
// contract past the 30th (the server's actual hard cap, ignoring the
// requested per_page) was invisible in this list, not just undercounted,
// because the table never linked to a next page. It now pages through
// /all-contracts the same way meetings/payments/files already did.

function Harness({ view }: { view: string }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  return <AMListView t={t} locale={locale} view={view} clients={[]} allPayments={[]} />;
}

function contract(id: number) {
  return {
    id,
    title: `Contract ${id}`,
    status: 'sent',
    contract_type: 'main',
    value: '1000',
    currency: 'SAR',
    created_at: '2026-09-01T00:00:00.000Z',
    workspace: { id: 1, client: { id: 5, company_name: 'Acme' } },
  };
}

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
});

describe('AMListView contracts pagination', () => {
  it('fetches the first page of /all-contracts instead of rendering a static list', async () => {
    mock.onGet('/all-contracts?page=1&per_page=10').reply(200, {
      contracts: { data: [contract(1)], last_page: 1, total: 1 },
    });
    renderWithIntl(<Harness view="contracts" />);

    await waitFor(() => expect(screen.getByText('Contract 1')).toBeInTheDocument());
  });

  // The actual bug: a contract beyond the server's old hard 30-row cap used
  // to simply never appear, with no next-page control to reach it.
  it('shows a next-page control when there is more than one page, and pages through it', async () => {
    mock.onGet('/all-contracts?page=1&per_page=10').reply(200, {
      contracts: { data: [contract(1)], last_page: 2, total: 11 },
    });
    mock.onGet('/all-contracts?page=2&per_page=10').reply(200, {
      contracts: { data: [contract(11)], last_page: 2, total: 11 },
    });
    renderWithIntl(<Harness view="contracts" />);

    await waitFor(() => expect(screen.getByText('Contract 1')).toBeInTheDocument());
    expect(screen.getByText('11')).toBeInTheDocument(); // the total badge

    await userEvent.click(screen.getByText('Next'));

    await waitFor(() => expect(screen.getByText('Contract 11')).toBeInTheDocument());
    expect(screen.queryByText('Contract 1')).not.toBeInTheDocument();
  });
});
