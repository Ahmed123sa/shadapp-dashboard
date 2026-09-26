import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { useTranslations, useLocale } from 'next-intl';
import { renderWithIntl } from '@/test/render';
import api from '@/lib/api';
import PendingApprovalsPanel from '../PendingApprovalsPanel';
import type { PendingApprovalsResponse } from '@/types';

// pending-approvals-plan.md ك2 — this panel replaces SAManagersView's old
// inline "Pending Approvals" card, which only ever listed approval-request
// items (from /approvals/pending) and disappeared entirely once that one
// sub-count hit zero — even though the badge/card next to it always summed
// three item types (contracts, payments, approval requests). It reads
// GET /dashboard/pending-approvals instead, the same list the count comes
// from, and shows an explicit empty state instead of hiding.
vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToNotifications: vi.fn(() => null),
}));

function Harness() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  return <PendingApprovalsPanel t={t} locale={locale} />;
}

function emptyResponse(): PendingApprovalsResponse {
  return {
    awaiting_you: { contracts: [], payments: [] },
    awaiting_client: { contracts: [], approvals: [] },
    counts: { pending_requests: 0, pending_contracts: 0, pending_payments: 0, total: 0 },
  };
}

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
});

describe('PendingApprovalsPanel', () => {
  it('shows an explicit empty state instead of hiding when there is nothing pending', async () => {
    mock.onGet('/dashboard/pending-approvals').reply(200, emptyResponse());
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText('Nothing pending')).toBeInTheDocument());
    expect(screen.queryByText(/View all/)).not.toBeInTheDocument();
  });

  it('lists a contract awaiting the staff member and one awaiting the client, each linking to the right client tab', async () => {
    const response = emptyResponse();
    response.awaiting_you.contracts = [{
      id: 1, type: 'contract', title: 'Villa Deal', value: '5000', currency: 'SAR', status: 'client_approved',
      workspace_id: 10, updated_at: new Date().toISOString(),
      client: { id: 1, uuid: 'client-uuid-1', company_name: 'Co-ops' },
    }];
    response.awaiting_client.contracts = [{
      id: 2, type: 'contract', title: 'Office Lease', value: '2000', currency: 'SAR', status: 'sent',
      workspace_id: 11, updated_at: new Date().toISOString(),
      client: { id: 2, uuid: 'client-uuid-2', company_name: 'Curve' },
    }];
    response.counts.total = 2;
    response.counts.pending_contracts = 2;
    mock.onGet('/dashboard/pending-approvals').reply(200, response);

    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText('Villa Deal')).toBeInTheDocument());
    expect(screen.getByText('Office Lease')).toBeInTheDocument();
    expect(screen.getByText('Villa Deal').closest('a')).toHaveAttribute('href', '/dashboard/clients/client-uuid-1?tab=contracts');
    expect(screen.getByText('Office Lease').closest('a')).toHaveAttribute('href', '/dashboard/clients/client-uuid-2?tab=contracts');
    // "awaiting you" (client_approved) is distinguished from "awaiting
    // client" (sent) — the exact conflation the plan's ن4 calls out.
    expect(screen.getByText('Awaiting you')).toBeInTheDocument();
    expect(screen.getByText('Awaiting client')).toBeInTheDocument();
  });

  it('shows a "view all" link with the real uncapped total', async () => {
    const response = emptyResponse();
    response.awaiting_client.contracts = [{
      id: 1, type: 'contract', title: 'Deal', value: '100', currency: 'SAR', status: 'sent',
      workspace_id: 1, updated_at: new Date().toISOString(),
      client: { id: 1, uuid: 'client-uuid', company_name: 'Co-ops' },
    }];
    response.counts.total = 12;
    mock.onGet('/dashboard/pending-approvals').reply(200, response);

    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText('View all (12)')).toBeInTheDocument());
    expect(screen.getByText('View all (12)').closest('a')).toHaveAttribute('href', '/dashboard?view=approvals');
  });

  it('links a payment item to the payments tab and an approval item to the approvals tab', async () => {
    const response = emptyResponse();
    response.awaiting_you.payments = [{
      id: 5, type: 'payment', amount: '900', currency: 'SAR', status: 'pending',
      workspace_id: 1, created_at: new Date().toISOString(),
      client: { id: 1, uuid: 'client-uuid', company_name: 'Co-ops' },
    }];
    response.awaiting_client.approvals = [{
      id: 6, type: 'approval', title: 'Design Sign-off', status: 'pending',
      workspace_id: 1, created_at: new Date().toISOString(),
      client: { id: 1, uuid: 'client-uuid', company_name: 'Co-ops' },
    }];
    response.counts.total = 2;
    mock.onGet('/dashboard/pending-approvals').reply(200, response);

    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText('Design Sign-off')).toBeInTheDocument());
    expect(screen.getByText('Design Sign-off').closest('a')).toHaveAttribute('href', '/dashboard/clients/client-uuid?tab=approvals');
    expect(screen.getByText('Payment from Co-ops').closest('a')).toHaveAttribute('href', '/dashboard/clients/client-uuid?tab=payments');
  });

  // plans/pending-approvals-fixes-plan.md ح٣ — a failed request used to fall
  // through to "Nothing pending", telling staff there was nothing to act on.
  it('shows a load error with a retry instead of "Nothing pending" when the request fails', async () => {
    mock.onGet('/dashboard/pending-approvals').replyOnce(500);
    renderWithIntl(<Harness />);

    await waitFor(() => expect(screen.getByText("Couldn't load pending approvals")).toBeInTheDocument());
    expect(screen.queryByText('Nothing pending')).not.toBeInTheDocument();

    mock.onGet('/dashboard/pending-approvals').reply(200, emptyResponse());
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Nothing pending')).toBeInTheDocument());
    expect(mock.history.get.filter((r) => r.url === '/dashboard/pending-approvals').length).toBe(2);
  });
});
