import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/test/render';
import LoginPage from '../page';
import { login } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ login: vi.fn() }));

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

// Neither label is programmatically associated with its input (no
// htmlFor/id) — getByLabelText can't find them, so these grab the inputs by
// type directly instead.
function emailInput(container: HTMLElement) {
  return container.querySelector('input[type="email"]') as HTMLInputElement;
}
function passwordInput(container: HTMLElement) {
  return container.querySelector('input[type="password"], input[type="text"][dir="ltr"]') as HTMLInputElement;
}

beforeEach(() => {
  push.mockClear();
  vi.mocked(login).mockReset();
});

describe('LoginPage', () => {
  it('logs in and redirects to /dashboard on success', async () => {
    vi.mocked(login).mockResolvedValue({ user: { id: 1, name: 'A', email: 'a@a.com', role: 'super_admin' } });
    const user = userEvent.setup();
    const { container } = renderWithIntl(<LoginPage />);

    await user.type(emailInput(container), 'a@a.com');
    await user.type(passwordInput(container), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(login).toHaveBeenCalledWith('a@a.com', 'secret123');
  });

  it('shows the server-provided error message and does not redirect', async () => {
    vi.mocked(login).mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
    const user = userEvent.setup();
    const { container } = renderWithIntl(<LoginPage />);

    await user.type(emailInput(container), 'a@a.com');
    await user.type(passwordInput(container), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('falls back to a generic error message when the server sends none', async () => {
    vi.mocked(login).mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    const { container } = renderWithIntl(<LoginPage />);

    await user.type(emailInput(container), 'a@a.com');
    await user.type(passwordInput(container), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
  });

  it('links to the forgot-password and client-login pages', () => {
    renderWithIntl(<LoginPage />);
    expect(screen.getByText('Forgot your password?').closest('a')).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByText('Client Login').closest('a')).toHaveAttribute('href', '/client-login');
  });
});
