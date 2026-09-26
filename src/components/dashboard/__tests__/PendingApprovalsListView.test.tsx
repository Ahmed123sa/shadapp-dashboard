import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { useTranslations, useLocale } from 'next-intl';
import { renderWithIntl } from '@/test/render';
import api from '@/lib/api';
import PendingApprovalsListView from '../PendingApprovalsListView';
import type { PendingApprovalsResponse } from '@/types';

// pending-approvals-plan.md ك4 — the full page behind the home panel's
// "view all" link and the "Pending Approvals" stat card. Unlike the panel
// (capped at 5, no filters), this page requests a much larger limit and
// lets the user filter by item type — mirroring the mobile app's
// sa_approvals_page.dart filter pills, which already solved the same
// "list doesn't match the count" problem there.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToNotifications: vi.fn(() => null),
}));

// ح٧ — the filter is read from / written to ?type= in the URL. currentType is
// what useSearchParams returns; replace is spied on to check what gets
// written back.
let currentType: string | null = null;
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get: (key: string) => (key === 'type' ? currentType : null) }),
}));

function Harness() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  return <PendingApprovalsListView t={t} locale={locale} />;
}

function responseWithItems(): PendingApprovalsResponse {
  return {
    awaiting_you: {
      contracts: [{
        id: 1, type: 'contract', title: 'Villa Deal', value: '5000', currency: 'SAR', status: 'client_approved',
        workspace_id: 1, updated_at: new Date().toISOString(),
        client: { id: 1, uuid: 'client-1', company_name: 'Co-ops' },
      }],
      payments: [{
        id: 2, type: 'payment', amount: '900', currency: 'SAR', status: 'pending',
        workspace_id: 1, created_at: new Date().toISOString(),
        client: { id: 1, uuid: 'client-1', company_name: 'Co-ops' },
      }],
    },
    awaiting_client: {
      contracts: [{
        id: 3, type: 'contract', title: 'Office Lease', value: '2000', currency: 'SAR', status: 'sent',
        workspace_id: 2, updated_at: new Date().toISOString(),
        client: { id: 2, uuid: 'client-2', company_name: 'Curve' },
      }],
      approvals: [{
        id: 4, type: 'approval', title: 'Design Sign-off', status: 'pending',
        workspace_id: 2, created_at: new Date().toISOString(),
        client: { id: 2, uuid: 'client-2', company_name: 'Curve' },
      }],
    },
    counts: { pending_requests: 1, pending_contracts: 2, pending_payments: 1, total: 4 },
  };
}

let mock: MockAdapter;

beforeEach(() => {
  currentType = null;
  replace.mockClear();
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
});

describe('PendingApprovalsListView', () => {
  it('requests a higher limit than the home panel and shows every item by default', async () => {
    mock.onGet('/dashboard/pending-approvals').reply((config) => {
      expect(config.params).toEqual({ limit: 200 });
      return [200, responseWithItems()];
    });
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText('Villa Deal')).toBeInTheDocument());
    expect(screen.getByText('Office Lease')).toBeInTheDocument();
    expect(screen.getByText('Payment from Co-ops')).toBeInTheDocument();
    expect(screen.getByText('Design Sign-off')).toBeInTheDocument();
  });

  it('filters the list down to one item type when a filter pill is clicked', async () => {
    mock.onGet('/dashboard/pending-approvals').reply(200, responseWithItems());
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText('Villa Deal')).toBeInTheDocument());

    fireEvent.click(screen.getByText(/^Approvals/));

    expect(screen.getByText('Design Sign-off')).toBeInTheDocument();
    expect(screen.queryByText('Villa Deal')).not.toBeInTheDocument();
    expect(screen.queryByText('Office Lease')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment from Co-ops')).not.toBeInTheDocument();
  });

  it('shows the real uncapped total in the header badge and the "back to dashboard" link', async () => {
    mock.onGet('/dashboard/pending-approvals').reply(200, responseWithItems());
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getAllByText('4').length).toBeGreaterThan(0));
    expect(screen.getByText('Back to Dashboard')).toHaveAttribute('href', '/dashboard');
  });

  it('shows an explicit empty state instead of an empty page when there is nothing pending', async () => {
    mock.onGet('/dashboard/pending-approvals').reply(200, {
      awaiting_you: { contracts: [], payments: [] },
      awaiting_client: { contracts: [], approvals: [] },
      counts: { pending_requests: 0, pending_contracts: 0, pending_payments: 0, total: 0 },
    });
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText('Nothing pending')).toBeInTheDocument());
  });

  // plans/pending-approvals-fixes-plan.md ح٣ — same as the home panel: a
  // failed load is an error with a retry, never "Nothing pending".
  it('shows an error state with a retry instead of "Nothing pending" when the request fails', async () => {
    mock.onGet('/dashboard/pending-approvals').replyOnce(500);
    renderWithIntl(<Harness />);

    const retry = await screen.findByRole('button', { name: /Try again|حاول تاني/ });
    expect(screen.queryByText('Nothing pending')).not.toBeInTheDocument();

    mock.onGet('/dashboard/pending-approvals').reply(200, responseWithItems());
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByText('Villa Deal')).toBeInTheDocument());
  });

  // plans/pending-approvals-fixes-plan.md ح٧ — the filter used to live only in
  // component state, so opening an item and pressing Back reset it to "All".
  describe('filter in the URL', () => {
    it('writes the chosen filter to ?type= (replace, not push) and clears it for "All"', async () => {
      mock.onGet('/dashboard/pending-approvals').reply(200, responseWithItems());
      renderWithIntl(<Harness />);
      await waitFor(() => expect(screen.getByText('Villa Deal')).toBeInTheDocument());

      fireEvent.click(screen.getByText(/^Payments/));
      expect(replace).toHaveBeenLastCalledWith('/dashboard?view=approvals&type=payment', { scroll: false });

      fireEvent.click(screen.getByText(/^All/));
      expect(replace).toHaveBeenLastCalledWith('/dashboard?view=approvals', { scroll: false });
    });

    it('opens pre-filtered from ?type= (e.g. after Back)', async () => {
      currentType = 'payment';
      mock.onGet('/dashboard/pending-approvals').reply(200, responseWithItems());
      renderWithIntl(<Harness />);

      await waitFor(() => expect(screen.getByText('Payment from Co-ops')).toBeInTheDocument());
      expect(screen.queryByText('Villa Deal')).not.toBeInTheDocument();
      expect(screen.queryByText('Design Sign-off')).not.toBeInTheDocument();
    });

    it('falls back to "All" for an unknown ?type=', async () => {
      currentType = 'bogus';
      mock.onGet('/dashboard/pending-approvals').reply(200, responseWithItems());
      renderWithIntl(<Harness />);

      await waitFor(() => expect(screen.getByText('Villa Deal')).toBeInTheDocument());
      expect(screen.getByText('Payment from Co-ops')).toBeInTheDocument();
      expect(screen.getByText('Design Sign-off')).toBeInTheDocument();
    });
  });
});
