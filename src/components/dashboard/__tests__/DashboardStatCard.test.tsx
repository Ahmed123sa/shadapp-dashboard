import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import { Clock } from 'lucide-react';
import DashboardStatCard from '../DashboardStatCard';

// pending-approvals-plan.md ك4/ن6 — this card used to be a plain
// non-interactive div with no href/onClick at all, even for "Pending
// Approvals" where a click-through to the full list is exactly what a user
// would expect. `href` is optional so every other card (which has nowhere
// sensible to link to) keeps rendering as a plain div, unchanged.
describe('DashboardStatCard', () => {
  it('renders as a plain div when no href is given', () => {
    render(<DashboardStatCard label="Total Clients" value={5} icon={Clock} />);

    expect(screen.getByText('Total Clients')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders as a link to the given href when one is provided', () => {
    render(<DashboardStatCard label="Pending Approvals" value={3} icon={Clock} href="/dashboard?view=approvals" />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/dashboard?view=approvals');
    expect(link).toHaveTextContent('Pending Approvals');
    expect(link).toHaveTextContent('3');
  });
});
