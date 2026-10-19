import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/test/render';
import ClientLoginPage from '../page';
import * as clientAuth from '@/lib/client-auth';

vi.mock('@/lib/client-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/client-auth')>()),
  clientLogin: vi.fn(),
  getClient: vi.fn(),
  isSubUser: vi.fn(),
  getSubUser: vi.fn(),
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
  vi.mocked(clientAuth.clientLogin).mockReset();
  vi.mocked(clientAuth.getClient).mockReturnValue(null as never);
  vi.mocked(clientAuth.isSubUser).mockReturnValue(false);
  vi.mocked(clientAuth.getSubUser).mockReturnValue(null);
});

describe('ClientLoginPage', () => {
  it('logs in and goes to /client-dashboard', async () => {
    vi.mocked(clientAuth.clientLogin).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderWithIntl(<ClientLoginPage />);

    await user.type(screen.getByLabelText('Email'), 'jane@acme.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/client-dashboard'));
    expect(clientAuth.clientLogin).toHaveBeenCalledWith('jane@acme.com', 'secret123');
  });

  it('shows the server error and stays on the page', async () => {
    vi.mocked(clientAuth.clientLogin).mockRejectedValue({ response: { data: { message: 'Bad credentials' } } });
    const user = userEvent.setup();
    renderWithIntl(<ClientLoginPage />);

    await user.type(screen.getByLabelText('Email'), 'jane@acme.com');
    await user.type(screen.getByLabelText('Password'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Bad credentials')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ClientLoginPage />);
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.type).toBe('text');
  });

  it('links to forgot-password (client) and to the admin login', () => {
    renderWithIntl(<ClientLoginPage />);
    expect(screen.getByText('Forgot your password?').closest('a')).toHaveAttribute('href', '/forgot-password?type=client');
    expect(screen.getByText('Admin Login').closest('a')).toHaveAttribute('href', '/login');
  });

  it('offers to continue when a client session already exists', () => {
    vi.mocked(clientAuth.getClient).mockReturnValue({ id: 7, company_name: 'Acme Corp', contact_person: 'Jane' } as never);
    renderWithIntl(<ClientLoginPage />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });
});
