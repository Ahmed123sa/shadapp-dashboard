import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/test/render';
import { ClientTypeBadge } from '../ClientTypeBadge';

describe('ClientTypeBadge', () => {
  it('renders nothing when clientType is missing', () => {
    const { container } = renderWithIntl(<ClientTypeBadge clientType={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders "Company" for a business client', () => {
    renderWithIntl(<ClientTypeBadge clientType="business" />);
    expect(screen.getByText('Company')).toBeInTheDocument();
  });

  it('renders "Individual" for any non-business value', () => {
    renderWithIntl(<ClientTypeBadge clientType="individual" />);
    expect(screen.getByText('Individual')).toBeInTheDocument();
  });

  it('uses smaller icon/text sizing when compact is set', () => {
    const { container: normal } = renderWithIntl(<ClientTypeBadge clientType="business" />);
    const { container: compact } = renderWithIntl(<ClientTypeBadge clientType="business" compact />);
    expect(normal.querySelector('span')?.className).toContain('text-[11px]');
    expect(compact.querySelector('span')?.className).toContain('text-[10px]');
  });
});
