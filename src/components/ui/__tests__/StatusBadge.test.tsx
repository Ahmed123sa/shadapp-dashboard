import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/test/render';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders the translated label for a known status', () => {
    renderWithIntl(<StatusBadge status="client_approved" />);
    expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
  });

  it('falls back to the raw status string for an unrecognized value', () => {
    renderWithIntl(<StatusBadge status="totally_made_up" />);
    expect(screen.getByText('totally_made_up')).toBeInTheDocument();
  });

  it('applies the default (unstyled-fallback) color for an unknown status without crashing', () => {
    const { container } = renderWithIntl(<StatusBadge status="totally_made_up" />);
    expect(container.querySelector('span')?.className).toContain('bg-zinc-700/30');
  });

  it('merges an extra className onto the badge', () => {
    const { container } = renderWithIntl(<StatusBadge status="draft" className="ml-2" />);
    expect(container.querySelector('span')?.className).toContain('ml-2');
  });
});
