import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import AuditLogPage from '../page';
import api from '@/lib/api';

vi.mock('@/lib/auth', () => ({
  getUser: () => ({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' }),
}));

let mock: MockAdapter;

function paymentLog(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    action: 'payment.approved',
    ip_address: '127.0.0.1',
    created_at: '2026-09-20T10:30:00Z',
    user: { id: 1, name: 'Ahmed' },
    auditable_type: 'App\\Models\\Payment',
    auditable: { id: 42, amount: '1000', currency: 'SAR', ...over },
  };
}

function mockLogs(logs: unknown[]) {
  mock.onGet(/\/audit-logs/).reply(200, {
    logs: { data: logs, last_page: 1, total: logs.length },
  });
  mock.onGet('/users').reply(200, []);
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('AuditLogPage entity column', () => {
  // This label used to be a hardcoded t('currency_egp'), so every payment
  // read as EGP no matter what it was actually paid in. In an audit log
  // that is not a formatting nit — it is a wrong figure in the one place
  // whose whole purpose is being trustworthy after the fact.
  it('shows a payment in the currency it was actually made in', async () => {
    mockLogs([paymentLog({ currency: 'SAR' })]);

    renderWithIntl(<AuditLogPage />);

    const table = within(await screen.findByRole('table'));
    expect(table.getByText(/1,000 SAR/)).toBeInTheDocument();
    expect(table.queryByText(/EGP/)).not.toBeInTheDocument();
  });

  it('does not relabel a USD payment as anything else', async () => {
    mockLogs([paymentLog({ currency: 'USD' })]);

    renderWithIntl(<AuditLogPage />);

    const table = within(await screen.findByRole('table'));
    expect(table.getByText(/1,000 USD/)).toBeInTheDocument();
  });

  it('honours any other currency the payment carries', async () => {
    mockLogs([paymentLog({ currency: 'EGP', amount: '250' })]);

    renderWithIntl(<AuditLogPage />);

    const table = within(await screen.findByRole('table'));
    expect(table.getByText(/250 EGP/)).toBeInTheDocument();
  });

  // Matches the backend default: PaymentController writes
  // `$request->currency ?? 'SAR'`, so a row with no currency is a SAR row.
  it('falls back to SAR when the payment has no currency', async () => {
    mockLogs([paymentLog({ currency: undefined })]);

    renderWithIntl(<AuditLogPage />);

    const table = within(await screen.findByRole('table'));
    expect(table.getByText(/1,000 SAR/)).toBeInTheDocument();
  });
});
