import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Btn, StatusDot, Switch, Segmented, Avatar } from '../index';

describe('client-portal ui', () => {
  it('StatusDot maps tones to the four mockup colours', () => {
    const { container, rerender } = render(<StatusDot tone="wait">Waiting</StatusDot>);
    expect(container.querySelector('.dot')).toHaveClass('w');
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    rerender(<StatusDot tone="crimson">x</StatusDot>);
    expect(container.querySelector('.dot')).toHaveClass('c');
    rerender(<StatusDot tone="faint">x</StatusDot>);
    expect(container.querySelector('.dot')).toHaveClass('g');
    rerender(<StatusDot />);
    expect(container.querySelector('.dot')).not.toHaveClass('w', 'c', 'g');
  });

  it('Btn applies variant + size classes and defaults to type=button', () => {
    render(<Btn variant="primary" size="lg">Go</Btn>);
    const b = screen.getByRole('button', { name: 'Go' });
    expect(b).toHaveClass('btn', 'primary', 'lg');
    expect(b).toHaveAttribute('type', 'button');
  });

  it('Switch toggles through onChange and exposes aria-checked', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Use chat" />);
    const sw = screen.getByRole('switch', { name: 'Use chat' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Switch does nothing when disabled', () => {
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} label="x" disabled />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Segmented marks the selected option and reports changes', () => {
    const onChange = vi.fn();
    render(
      <Segmented
        value="draw"
        onChange={onChange}
        options={[
          { value: 'draw', label: 'Draw' },
          { value: 'type', label: 'Type' },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Draw' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Type' }));
    expect(onChange).toHaveBeenCalledWith('type');
  });

  it('Avatar shows the initial or the image', () => {
    const { container, rerender } = render(<Avatar name="mona" />);
    expect(container.querySelector('.av')).toHaveTextContent('M');
    rerender(<Avatar name="mona" src="/a.png" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/a.png');
  });
});
