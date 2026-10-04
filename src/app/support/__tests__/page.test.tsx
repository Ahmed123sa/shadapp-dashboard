import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/test/render';
import SupportPage from '../page';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fillAndSend(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Your name'), 'Sara');
  await user.type(screen.getByLabelText('Your email'), 'sara@example.com');
  await user.type(screen.getByLabelText('How can we help?'), 'My contract does not open.');
  await user.click(screen.getByRole('button', { name: 'Send message' }));
}

describe('SupportPage', () => {
  it('posts the form to the public support endpoint and shows a confirmation', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const user = userEvent.setup();
    renderWithIntl(<SupportPage />);

    await fillAndSend(user);

    expect(await screen.findByText('Your message was sent. We will reply to your email soon.')).toBeInTheDocument();
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('/api/proxy/support');
    expect(JSON.parse(init.body)).toMatchObject({
      name: 'Sara',
      email: 'sara@example.com',
      message: 'My contract does not open.',
      website: '',
    });
  });

  it('shows the server error when sending fails', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: 'Server said no' }) });
    const user = userEvent.setup();
    renderWithIntl(<SupportPage />);

    await fillAndSend(user);

    expect(await screen.findByText('Server said no')).toBeInTheDocument();
  });

  it('switches to Arabic', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SupportPage />);

    await user.click(screen.getByRole('button', { name: 'العربية' }));

    expect(screen.getByText('دعم ShadApp')).toBeInTheDocument();
  });

  it('shows the support email', () => {
    renderWithIntl(<SupportPage />);

    expect(screen.getByRole('link', { name: 'support@shadmanagement.co' })).toBeInTheDocument();
  });
});
