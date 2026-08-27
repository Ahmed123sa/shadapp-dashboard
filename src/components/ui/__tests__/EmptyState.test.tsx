import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders the message', () => {
    render(<EmptyState message="No clients yet" />);
    expect(screen.getByText('No clients yet')).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    render(
      <EmptyState message="No clients yet">
        <button>Add client</button>
      </EmptyState>
    );
    expect(screen.getByText('Add client')).toBeInTheDocument();
  });

  it('renders no extra wrapper when children are omitted', () => {
    const { container } = render(<EmptyState message="No clients yet" />);
    expect(container.querySelectorAll('div').length).toBe(1);
  });
});
