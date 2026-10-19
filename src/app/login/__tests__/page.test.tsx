import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/test/render';
import LoginPage from '../page';
import { login } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ login: vi.fn() }));
vi.mock('@/lib/client-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/client-auth')>()),
  clientLogin: vi.fn(),
  getClient: vi.fn(() => null),
}));
import { clientLogin } from '@/lib/client-auth';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

function emailInput() {
  return screen.getByLabelText('Email') as HTMLInputElement;
}
function passwordInput() {
  return screen.getByLabelText('Password') as HTMLInputElement;
}

beforeEach(() => {
  push.mockClear();
  vi.mocked(login).mockReset();
});

describe('LoginPage', () => {
  it('logs in and redirects to /dashboard on success', async () => {
    vi.mocked(login).mockResolvedValue({ user: { id: 1, name: 'A', email: 'a@a.com', role: 'super_admin' } });
    const user = userEvent.setup();
    renderWithIntl(<LoginPage />);

    await user.type(emailInput(), 'a@a.com');
    await user.type(passwordInput(), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(login).toHaveBeenCalledWith('a@a.com', 'secret123');
  });

  it('shows the server-provided error message and does not redirect', async () => {
    vi.mocked(login).mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
    const user = userEvent.setup();
    renderWithIntl(<LoginPage />);

    await user.type(emailInput(), 'a@a.com');
    await user.type(passwordInput(), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('falls back to a generic error message when the server sends none', async () => {
    vi.mocked(login).mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderWithIntl(<LoginPage />);

    await user.type(emailInput(), 'a@a.com');
    await user.type(passwordInput(), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
  });

  it('links to forgot-password (staff) and opens on the team side of the switch', () => {
    renderWithIntl(<LoginPage />);
    expect(screen.getByText('Forgot your password?').closest('a')).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('tab', { name: 'Managers & team' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to the client side: client forgot link, client login call, /client-dashboard', async () => {
    const spy = vi.mocked(clientLogin).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderWithIntl(<LoginPage />);

    await user.click(screen.getByRole('tab', { name: 'Client' }));
    expect(screen.getByText('Forgot your password?').closest('a')).toHaveAttribute('href', '/forgot-password?type=client');

    await user.type(emailInput(), 'jane@acme.com');
    await user.type(passwordInput(), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/client-dashboard'));
    expect(spy).toHaveBeenCalledWith('jane@acme.com', 'secret123');
    expect(login).not.toHaveBeenCalled();
  });
});
