import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
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

// 21 Sept 2026 — the revenue KPI card and the chart tooltip both used to sum
// every currency into one number and label it with a hardcoded "EGP". These
// cover the replacement: the KPI card shows the biggest currency as the
// headline and the rest smaller, and the chart shows one currency at a time
// via a toggle instead of one line per currency (currencies are different
// scales, not different colors of the same series).
describe('ReportsPage revenue currency handling', () => {
  it('shows the biggest currency as the headline and the rest on a smaller line, with no delta arrow', async () => {
    mockReports({
      payments_by_month_by_currency: {
        '2026-09': { SAR: 85000, USD: 6000, EGP: 310000 },
      },
    });

    renderWithIntl(<ReportsPage />);

    const kpiTitles = await screen.findAllByText('Monthly Revenue');
    const kpiCard = kpiTitles.map((el) => el.closest('.kpi')).find(Boolean) as HTMLElement;
    expect(kpiCard).toBeTruthy();

    // EGP has the largest total (310000), so it's the headline, not SAR.
    expect(kpiCard.textContent).toContain('310K');
    expect(kpiCard.textContent).toContain('EGP');
    expect(kpiCard.textContent).toContain('85K SAR');
    expect(kpiCard.textContent).toContain('6K USD');
    // The delta arrow/subtitle every other KPI card shows is gone here —
    // it implied a trend nothing on this card computes.
    expect(kpiCard.textContent).not.toContain('vs previous');
  });

  it('shows just the headline figure with no secondary line when there is only one currency', async () => {
    mockReports({
      payments_by_month_by_currency: { '2026-09': { SAR: 12000 } },
    });

    renderWithIntl(<ReportsPage />);

    const kpiTitles = await screen.findAllByText('Monthly Revenue');
    const kpiCard = kpiTitles.map((el) => el.closest('.kpi')).find(Boolean) as HTMLElement;

    expect(kpiCard.textContent).toContain('12K');
    expect(kpiCard.textContent).toContain('SAR');
    expect(kpiCard.textContent).not.toContain('·');
  });

  it('does not show currency toggle buttons when there is only one currency', async () => {
    mockReports({
      payments_by_month_by_currency: { '2026-09': { SAR: 12000 } },
    });

    renderWithIntl(<ReportsPage />);

    await screen.findAllByText('Monthly Revenue');
    expect(document.querySelectorAll('.cf-btn')).toHaveLength(0);
  });

  it('defaults the chart to the currency with the largest total and switches on click', async () => {
    mockReports({
      payments_by_month_by_currency: {
        '2026-08': { SAR: 1000, USD: 9000 },
        '2026-09': { SAR: 2000, USD: 1000 },
      },
    });

    renderWithIntl(<ReportsPage />);

    await screen.findAllByText('Monthly Revenue');
    const buttons = Array.from(document.querySelectorAll('.cf-btn')) as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent)).toEqual(expect.arrayContaining(['SAR', 'USD']));

    // USD totals 10000 vs SAR's 3000, so USD starts selected.
    const usdBtn = buttons.find((b) => b.textContent === 'USD')!;
    const sarBtn = buttons.find((b) => b.textContent === 'SAR')!;
    expect(usdBtn.className).toContain('on');
    expect(sarBtn.className).not.toContain('on');

    fireEvent.click(sarBtn);

    expect(sarBtn.className).toContain('on');
    expect(usdBtn.className).not.toContain('on');
  });
});
