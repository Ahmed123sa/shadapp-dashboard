import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/test/render';
import ToastNotification, { showToast } from '../ToastNotification';

// Characterization + regression test written alongside the a11y fix that
// made each toast keyboard-operable (tabIndex/role="button"/onKeyDown),
// added an aria-live region so screen readers announce new toasts, and
// gave the dismiss "×" button a real aria-label instead of being unnamed.

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
});

describe('ToastNotification', () => {
  it('renders nothing when no toast has been shown', () => {
    const { container } = renderWithIntl(<ToastNotification />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a toast pushed via showToast(), with its container announced to screen readers', async () => {
    renderWithIntl(<ToastNotification />);
    showToast({ id: 't1', title: 'New message', message: 'Hello there' });

    expect(await screen.findByText('New message')).toBeInTheDocument();
    expect(screen.getByText('Hello there')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('is reachable by keyboard: Enter on the toast navigates to its href and dismisses it', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ToastNotification />);
    showToast({ id: 't2', title: 'Approval needed', message: 'Client X', href: '/dashboard/approvals' });

    const toast = await screen.findByText('Approval needed');
    const toastRoot = toast.closest('[role="button"]') as HTMLElement;
    expect(toastRoot).toHaveAttribute('tabindex', '0');

    toastRoot.focus();
    await user.keyboard('{Enter}');

    expect(push).toHaveBeenCalledWith('/dashboard/approvals');
    expect(screen.queryByText('Approval needed')).not.toBeInTheDocument();
  });

  it('the dismiss button has an accessible name and removes the toast without navigating', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ToastNotification />);
    showToast({ id: 't3', title: 'Reminder', message: 'Meeting soon', href: '/dashboard' });

    await screen.findByText('Reminder');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByText('Reminder')).not.toBeInTheDocument();
  });
});
