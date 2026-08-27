import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/test/render';
import ContractStatusStepper from '../ContractStatusStepper';

describe('ContractStatusStepper', () => {
  it('shows the label for the current status (non-compact)', () => {
    renderWithIntl(<ContractStatusStepper status="client_approved" />);
    expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
  });

  it('marks steps before the current one as complete (checkmark)', () => {
    const { container } = renderWithIntl(<ContractStatusStepper status="company_approved" />);
    // Scoped to .rounded-full: the step circles are the only rounded-full
    // elements, so this avoids double-counting each circle's non-rounded
    // wrapping <div> (which shares the same textContent since the adjacent
    // connector line has none).
    const checks = Array.from(container.querySelectorAll('.rounded-full')).filter((el) => el.textContent === '✓');
    // draft, sent, client_approved are before company_approved => 3 checkmarks.
    expect(checks.length).toBe(3);
  });

  it('falls back to the first step when the status is unrecognized', () => {
    // activeIndex = -1 => current = 0 (draft) — must not crash on an
    // out-of-range index and must not mark anything as "complete".
    const { container } = renderWithIntl(<ContractStatusStepper status="not_a_real_status" />);
    const checks = Array.from(container.querySelectorAll('.rounded-full')).filter((el) => el.textContent === '✓');
    expect(checks.length).toBe(0);
  });

  it('renders without the trailing label in compact mode', () => {
    renderWithIntl(<ContractStatusStepper status="draft" compact />);
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
  });
});
