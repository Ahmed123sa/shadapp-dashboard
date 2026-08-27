import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/test/render';
import ForgotPasswordPage from '../page';

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

beforeEach(() => {
  searchParams = new URLSearchParams();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function emailInput(container: HTMLElement) {
  return container.querySelector('input[type="email"]') as HTMLInputElement;
}

describe('ForgotPasswordPage', () => {
  it('posts to the staff endpoint by default and shows the sent confirmation', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const user = userEvent.setup();
    const { container } = renderWithIntl(<ForgotPasswordPage />);

    await user.type(emailInput(container), 'a@a.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText(/sent/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/proxy/auth/forgot-password',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('posts to the client endpoint when ?type=client is present', async () => {
    searchParams = new URLSearchParams('type=client');
    (global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const user = userEvent.setup();
    const { container } = renderWithIntl(<ForgotPasswordPage />);

    await user.type(emailInput(container), 'c@a.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    await screen.findByText(/sent/i);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/proxy/auth/client/forgot-password',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('shows the definitive "link sent" confirmation, not the subtitle copy', async () => {
    // Regression: the success state used to render the pre-submit subtitle
    // text instead of the actual "we sent you a link" confirmation.
    (global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const user = userEvent.setup();
    const { container } = renderWithIntl(<ForgotPasswordPage />);

    await user.type(emailInput(container), 'a@a.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    await screen.findByText(/sent/i);
    // The pre-submit instructional copy must be gone once we're in the
    // "sent" state — it's a different message, not a relabeled version.
    expect(screen.queryByText(/enter your email/i)).not.toBeInTheDocument();
  });

  it('shows a server error message and stays on the form (never claims success)', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ errors: { email: ['البريد الإلكتروني غير مسجل'] } }),
    });
    const user = userEvent.setup();
    const { container } = renderWithIntl(<ForgotPasswordPage />);

    await user.type(emailInput(container), 'a@a.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});
