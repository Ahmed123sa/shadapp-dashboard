import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/test/render';
import ResetPasswordPage from '../page';

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

beforeEach(() => {
  searchParams = new URLSearchParams('token=tok-123&email=a%40a.com');
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function passwordInputs(container: HTMLElement) {
  return Array.from(container.querySelectorAll('input[type="password"], input[type="text"][dir="ltr"]')) as HTMLInputElement[];
}

describe('ResetPasswordPage', () => {
  it('shows an "invalid link" message when the token or email is missing', () => {
    searchParams = new URLSearchParams(); // neither token nor email
    renderWithIntl(<ResetPasswordPage />);
    expect(screen.getByText('This link is invalid or incomplete. Request a new one.')).toBeInTheDocument();
  });

  it('rejects a mismatched confirmation without calling the server', async () => {
    const user = userEvent.setup();
    const { container } = renderWithIntl(<ResetPasswordPage />);

    const [password, confirmation] = passwordInputs(container);
    await user.type(password, 'longenoughpw');
    await user.type(confirmation, 'somethingelse');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByText("The two passwords don't match.")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a too-short password without calling the server', async () => {
    const user = userEvent.setup();
    const { container } = renderWithIntl(<ResetPasswordPage />);

    const [password, confirmation] = passwordInputs(container);
    await user.type(password, 'short1');
    await user.type(confirmation, 'short1');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('posts to the staff endpoint with token/email/password on success', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const user = userEvent.setup();
    const { container } = renderWithIntl(<ResetPasswordPage />);

    const [password, confirmation] = passwordInputs(container);
    await user.type(password, 'longenoughpw');
    await user.type(confirmation, 'longenoughpw');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByText('Your password has been changed. You can sign in now.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/proxy/auth/reset-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          token: 'tok-123',
          email: 'a@a.com',
          password: 'longenoughpw',
          password_confirmation: 'longenoughpw',
        }),
      })
    );
  });

  it('posts to the client endpoint when ?type=client is present', async () => {
    searchParams = new URLSearchParams('token=tok-123&email=a%40a.com&type=client');
    (global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const user = userEvent.setup();
    const { container } = renderWithIntl(<ResetPasswordPage />);

    const [password, confirmation] = passwordInputs(container);
    await user.type(password, 'longenoughpw');
    await user.type(confirmation, 'longenoughpw');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    await screen.findByText('Your password has been changed. You can sign in now.');
    expect(global.fetch).toHaveBeenCalledWith('/api/proxy/auth/client/reset-password', expect.anything());
  });

  it('surfaces a validation error from the server (e.g. an expired token)', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'This reset link has expired.' }),
    });
    const user = userEvent.setup();
    const { container } = renderWithIntl(<ResetPasswordPage />);

    const [password, confirmation] = passwordInputs(container);
    await user.type(password, 'longenoughpw');
    await user.type(confirmation, 'longenoughpw');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByText('This reset link has expired.')).toBeInTheDocument();
  });
});
