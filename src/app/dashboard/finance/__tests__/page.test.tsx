import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import FinancePage from '../page';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
  isAuthenticated: vi.fn(() => true),
}));

let mock: MockAdapter;

const mockPaymentsData = {
  payments: {
    data: [
      {
        id: 101,
        amount: '5000.00',
        currency: 'SAR',
        method_type: 'bank_transfer',
        status: 'approved',
        created_at: '2026-08-30T10:00:00Z',
        workspace: {
          client: { id: 1, company_name: 'Acme Corp', contact_person: 'John Doe' },
          manager: { id: 2, name: 'Manager Mike' },
        },
        contract: { id: 10, title: 'Annual Retainer' },
        proof_file_url: 'payments/proof.pdf',
      },
    ],
    current_page: 1,
    last_page: 1,
    total: 1,
  },
  stats: {
    total_count: 1,
    approved_count: 1,
    pending_count: 0,
    approved_total_sar: 5000,
    approved_total_usd: 0,
  },
};

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Admin', email: 'admin@example.com', role: 'super_admin' });

  mock.onGet(/\/clients/).reply(200, { clients: [{ id: 1, company_name: 'Acme Corp' }] });
  mock.onGet(/\/account-managers/).reply(200, { account_managers: [{ id: 2, name: 'Manager Mike' }] });
  mock.onGet(/\/users/).reply(200, [{ id: 2, name: 'Manager Mike' }]);
  mock.onGet(/\/all-payments/).reply(200, mockPaymentsData);
});

afterEach(() => {
  mock.restore();
});

describe('FinancePage', () => {
  it('renders stats and payments table properly', async () => {
    renderWithIntl(<FinancePage />);

    expect(await screen.findByText('Annual Retainer')).toBeInTheDocument();
    expect(screen.getAllByText('Manager Mike').length).toBe(2);
  });

  // Finance UX fix: currency KPI cards used to always pin SAR and USD
  // (showing 0.00 even with zero real data) and only show other currencies
  // dynamically. Now every currency — SAR/USD included — is driven purely
  // by approved_by_currency and only gets a card when money actually moved
  // in it (nonzero total).
  it('renders a card for every currency with a nonzero approved total, SAR included, from approved_by_currency', async () => {
    mock.onGet(/\/all-payments/).reply(200, {
      ...mockPaymentsData,
      stats: {
        ...mockPaymentsData.stats,
        approved_by_currency: { SAR: 5000, EGP: 1200 },
      },
    });

    renderWithIntl(<FinancePage />);

    expect(await screen.findByText('Annual Retainer')).toBeInTheDocument();
    // 5,000.00 appears both on the SAR KPI card and in the payments table row
    // for the same mock payment — getAllByText rather than getByText.
    expect(screen.getAllByText(/5,000\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('SAR').length).toBeGreaterThan(0);
    expect(screen.getByText(/1,200\.00/)).toBeInTheDocument();
    expect(screen.getAllByText('EGP').length).toBeGreaterThan(0);
  });

  it('does not render a card for a currency with a zero approved total, even SAR/USD', async () => {
    mock.onGet(/\/all-payments/).reply(200, {
      ...mockPaymentsData,
      stats: {
        ...mockPaymentsData.stats,
        approved_by_currency: { SAR: 0, USD: 0, EGP: 900 },
      },
    });

    renderWithIntl(<FinancePage />);

    expect(await screen.findByText('Annual Retainer')).toBeInTheDocument();
    expect(screen.getByText(/900\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/المدفوعات المعتمدة \(SAR\)|Approved SAR/)).not.toBeInTheDocument();
    expect(screen.queryByText(/المدفوعات المعتمدة \(USD\)|Approved USD/)).not.toBeInTheDocument();
  });

  it('shows no currency cards at all when nothing has been approved yet', async () => {
    renderWithIntl(<FinancePage />);

    expect(await screen.findByText('Annual Retainer')).toBeInTheDocument();
    expect(screen.queryByText(/المدفوعات المعتمدة|Approved (SAR|USD)/)).not.toBeInTheDocument();
  });

  it('triggers reload when searching or filtering', async () => {
    const user = userEvent.setup();
    renderWithIntl(<FinancePage />);

    expect(await screen.findByText('Annual Retainer')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/بحث بالمبلغ|Search by amount/i);
    await user.type(searchInput, 'Acme');

    const applyButton = screen.getByRole('button', { name: /تطبيق|Apply/i });
    await user.click(applyButton);

    expect(mock.history.get.some(req => req.url?.includes('search=Acme'))).toBe(true);
  });
});