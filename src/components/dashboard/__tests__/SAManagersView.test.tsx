import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { useTranslations, useLocale } from 'next-intl';
import { renderWithIntl } from '@/test/render';
import SAManagersView from '../SAManagersView';
import type { Payment } from '@/components/dashboard/types';

// The revenue card had no coverage at all, which is how it stayed wrong for
// so long. It summed every payment ever made, of any status, in any
// currency, into a single figure labelled "Monthly Revenue".
//
// SAManagersView takes `t` as a prop rather than calling useTranslations
// itself, so this harness supplies a real one (and a real locale) from the
// same provider the app uses — a hand-rolled stub would let a renamed
// translation key pass here and break in the app.
function Harness({ payments }: { payments: Payment[] }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  return (
    <SAManagersView
      t={t}
      locale={locale}
      managers={[]}
      allContracts={[]}
      allPayments={payments}
      allMeetings={[]}
      pendingApprovals={[]}
      unreadCount={0}
    />
  );
}

const thisMonth = new Date().toISOString();
const lastMonth = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  // Guard against the 31st-of-a-month rollover landing back in this month.
  d.setDate(1);
  return d.toISOString();
})();

function payment(over: Partial<Payment>): Payment {
  return {
    id: 1,
    amount: '1000',
    currency: 'SAR',
    method_type: 'bank_transfer',
    status: 'approved',
    created_at: thisMonth,
    ...over,
  };
}

/** The card's value, isolated from the rest of the dashboard. */
function revenueCard() {
  return screen.getByText('Monthly Revenue').closest('div')!.parentElement!;
}

describe('SAManagersView revenue card', () => {
  // The headline bug: different currencies are not addable, and this system
  // holds no exchange rates, so there is no honest single figure to show.
  it('keeps each currency on its own line instead of summing them', () => {
    renderWithIntl(
      <Harness
        payments={[
          payment({ id: 1, amount: '1000', currency: 'SAR' }),
          payment({ id: 2, amount: '500', currency: 'USD' }),
        ]}
      />
    );

    const card = within(revenueCard());
    expect(card.getByText('SAR')).toBeInTheDocument();
    expect(card.getByText('USD')).toBeInTheDocument();
    expect(card.getByText('1,000')).toBeInTheDocument();
    expect(card.getByText('500')).toBeInTheDocument();
    // The old behaviour: 1000 + 500 rendered as a single "1,500" / "2K".
    expect(card.queryByText('1,500')).not.toBeInTheDocument();
  });

  it('adds up several payments in the same currency', () => {
    renderWithIntl(
      <Harness
        payments={[
          payment({ id: 1, amount: '1000', currency: 'SAR' }),
          payment({ id: 2, amount: '250', currency: 'SAR' }),
        ]}
      />
    );

    expect(within(revenueCard()).getByText('1,250')).toBeInTheDocument();
  });

  it('ignores payments that are not approved', () => {
    renderWithIntl(
      <Harness
        payments={[
          payment({ id: 1, amount: '1000', currency: 'SAR', status: 'approved' }),
          payment({ id: 2, amount: '9999', currency: 'SAR', status: 'pending' }),
          payment({ id: 3, amount: '8888', currency: 'SAR', status: 'rejected' }),
        ]}
      />
    );

    const card = within(revenueCard());
    expect(card.getByText('1,000')).toBeInTheDocument();
    expect(card.queryByText('9,999')).not.toBeInTheDocument();
    expect(card.queryByText('8,888')).not.toBeInTheDocument();
  });

  // The label says "Monthly Revenue"; before this it was revenue since the
  // beginning of time.
  it('ignores payments from other months', () => {
    renderWithIntl(
      <Harness
        payments={[
          payment({ id: 1, amount: '1000', currency: 'SAR', created_at: thisMonth }),
          payment({ id: 2, amount: '7777', currency: 'SAR', created_at: lastMonth }),
        ]}
      />
    );

    const card = within(revenueCard());
    expect(card.getByText('1,000')).toBeInTheDocument();
    expect(card.queryByText('7,777')).not.toBeInTheDocument();
  });

  it('shows a dash rather than a zero when there is nothing this month', () => {
    renderWithIntl(<Harness payments={[payment({ created_at: lastMonth })]} />);

    expect(within(revenueCard()).getByText('—')).toBeInTheDocument();
  });

  it('falls back to SAR when a payment carries no currency', () => {
    renderWithIntl(
      <Harness payments={[{ ...payment({ amount: '300' }), currency: '' }]} />
    );

    const card = within(revenueCard());
    expect(card.getByText('300')).toBeInTheDocument();
    expect(card.getByText('SAR')).toBeInTheDocument();
  });
});
