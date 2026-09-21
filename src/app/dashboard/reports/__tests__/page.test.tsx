import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ReportsPage from '../page';
import api from '@/lib/api';

let mock: MockAdapter;

function mockReports(extra: Record<string, unknown> = {}) {
  mock.onGet(/\/reports/).reply(200, {
    total_clients: 1,
    contracts_by_status: {},
    payments_by_month: {},
    approval_stats: { approved: 0, rejected: 0, pending: 0 },
    pending_approvals: 0,
    active_workspaces: 0,
    recent_logins: 0,
    ...extra,
  });
  mock.onGet(/\/clients/).reply(200, { clients: [] });
  mock.onGet(/\/account-managers/).reply(200, { managers: [] });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

// 21 Sept 2026 — the leaderboard used to read `m.revenue ?? (totalRevenue /
// (i + 2))`. Since the backend never sent manager_stats, every row hit that
// fallback: a fraction of the (currency-summed) total, made to look like a
// real per-manager figure. Now the backend sends real manager_stats, and
// these tests cover the two things that were wrong: the number itself, and
// the ranking bar width that used to be a fixed 90/65/72 regardless of data.
describe('ReportsPage manager leaderboard', () => {
  it('shows each manager\'s real revenue instead of a fraction of the total', async () => {
    mockReports({
      manager_stats: [
        { name: 'Sara', revenue: 8000, clients: 5, contracts: 3 },
        { name: 'Omar', revenue: 4000, clients: 2, contracts: 1 },
      ],
    });

    renderWithIntl(<ReportsPage />);

    expect(await screen.findByText('Sara')).toBeInTheDocument();
    expect(screen.getByText('8K')).toBeInTheDocument();
    expect(screen.getByText('Omar')).toBeInTheDocument();
    expect(screen.getByText('4K')).toBeInTheDocument();
  });

  it('shows "—" for a manager with no revenue instead of guessing one', async () => {
    mockReports({
      manager_stats: [{ name: 'NoRevenueYet', clients: 1, contracts: 0 }],
    });

    renderWithIntl(<ReportsPage />);

    expect(await screen.findByText('NoRevenueYet')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the no-performance-data message when manager_stats is empty', async () => {
    mockReports({ manager_stats: [] });

    renderWithIntl(<ReportsPage />);

    expect(await screen.findByText('No performance data available')).toBeInTheDocument();
  });

  it('scales the ranking bar to actual revenue instead of a fixed ladder', async () => {
    mockReports({
      manager_stats: [
        { name: 'Top', revenue: 1000, clients: 1, contracts: 1 },
        { name: 'Half', revenue: 500, clients: 1, contracts: 1 },
      ],
    });

    renderWithIntl(<ReportsPage />);

    await screen.findByText('Top');
    const bars = document.querySelectorAll('.lb-bar');
    expect(bars).toHaveLength(2);
    expect((bars[0] as HTMLElement).style.width).toBe('100%');
    expect((bars[1] as HTMLElement).style.width).toBe('50%');
  });
});
