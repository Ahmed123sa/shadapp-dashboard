import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/test/render';
import { LoadingSkeleton, DashboardSkeleton, ReportsSkeleton, TableSkeleton } from '../LoadingSkeleton';

describe('LoadingSkeleton', () => {
  it('shows a custom message when given', () => {
    renderWithIntl(<LoadingSkeleton message="Fetching clients..." />);
    expect(screen.getByText('Fetching clients...')).toBeInTheDocument();
  });

  it('falls back to the translated default loading text', () => {
    renderWithIntl(<LoadingSkeleton />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe('DashboardSkeleton / ReportsSkeleton / TableSkeleton', () => {
  it('render without crashing and without requiring any props', () => {
    expect(() => renderWithIntl(<DashboardSkeleton />)).not.toThrow();
    expect(() => renderWithIntl(<ReportsSkeleton />)).not.toThrow();
    expect(() => renderWithIntl(<TableSkeleton />)).not.toThrow();
  });

  it('TableSkeleton renders the requested number of placeholder rows', () => {
    const { container } = renderWithIntl(<TableSkeleton rows={3} />);
    // 1 header row (border-b) + 3 body rows = 4 flex rows total.
    expect(container.querySelectorAll('.flex.items-center.gap-4').length).toBe(4);
  });
});
