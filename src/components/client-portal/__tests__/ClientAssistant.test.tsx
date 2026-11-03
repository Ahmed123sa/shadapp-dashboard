import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientAssistant from '../ClientAssistant';
import api from '@/lib/api';
import * as clientAuth from '@/lib/client-auth';

vi.mock('@/lib/client-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/client-auth')>()),
  getClient: vi.fn(),
}));

let mock: MockAdapter;

const ENABLED = {
  enabled: true,
  assistant: {
    name: { ar: 'مساعد شاد', en: 'Shad assistant' },
    welcome: { ar: 'أهلاً أحمد', en: 'Hi Ahmed' },
  },
  questions: [
    {
      id: 2, key: 'balance', kind: 'data',
      question: { ar: 'فاضل عليّا كام؟', en: 'How much do I still owe?' },
      answer: { ar: 'فاضل عليك 12,500.00 SAR', en: 'You still owe 12,500.00 SAR' },
      progress: { paid: 37500, total: 50000 },
      actions: [{ target: 'payments' }],
    },
    {
      id: 11, key: null, kind: 'faq',
      question: { ar: 'مواعيد العمل؟', en: 'Working hours?' },
      answer: { ar: 'من 9 لـ 5', en: '9 to 5' },
      actions: [],
    },
  ],
};

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(clientAuth.getClient).mockReturnValue({ id: 7, company_name: 'Acme' } as any);
  mock.onGet('/clients/7').reply(200, { client: { id: 7, workspace: { id: 22, status: 'active' } } });
});

describe('ClientAssistant', () => {
  it('shows nothing while the server has it switched off', async () => {
    mock.onGet('/workspaces/22/assistant').reply(200, { enabled: false });
    renderWithIntl(<ClientAssistant />);

    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/workspaces/22/assistant')).toBe(true));
    expect(screen.queryByRole('button', { name: /assistant/i })).toBeNull();
  });

  it('shows nothing when the request fails, instead of an error', async () => {
    mock.onGet('/workspaces/22/assistant').reply(500);
    renderWithIntl(<ClientAssistant />);

    await waitFor(() => expect(mock.history.get.some((r) => r.url === '/workspaces/22/assistant')).toBe(true));
    expect(screen.queryByRole('button', { name: /assistant/i })).toBeNull();
  });

  it('opens with the welcome and every question, then answers one tap with a link to the right tab', async () => {
    mock.onGet('/workspaces/22/assistant').reply(200, ENABLED);
    const user = userEvent.setup();
    renderWithIntl(<ClientAssistant />);

    await user.click(await screen.findByRole('button', { name: 'Shad assistant' }));

    expect(screen.getByRole('dialog', { name: 'Shad assistant' })).toBeInTheDocument();
    expect(screen.getByText('Hi Ahmed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'How much do I still owe?' }));

    expect(screen.getByText('You still owe 12,500.00 SAR')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '37500');
    expect(screen.getByRole('link', { name: 'Open payments' })).toHaveAttribute('href', '/client-dashboard?tab=payments');
  });

  it('answers a FAQ with no button when it has no target', async () => {
    mock.onGet('/workspaces/22/assistant').reply(200, ENABLED);
    const user = userEvent.setup();
    renderWithIntl(<ClientAssistant />);

    await user.click(await screen.findByRole('button', { name: 'Shad assistant' }));
    await user.click(screen.getByRole('button', { name: 'Working hours?' }));

    expect(screen.getByText('9 to 5')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('closes on Escape and gives the focus back to the button', async () => {
    mock.onGet('/workspaces/22/assistant').reply(200, ENABLED);
    const user = userEvent.setup();
    renderWithIntl(<ClientAssistant />);

    const fab = await screen.findByRole('button', { name: 'Shad assistant' });
    await user.click(fab);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fab).toHaveFocus();
  });

  it('reads the wording in the page language', async () => {
    mock.onGet('/workspaces/22/assistant').reply(200, ENABLED);
    const user = userEvent.setup();
    renderWithIntl(<ClientAssistant />, { locale: 'ar' });

    await user.click(await screen.findByRole('button', { name: 'مساعد شاد' }));
    await user.click(screen.getByRole('button', { name: 'فاضل عليّا كام؟' }));

    expect(screen.getByText('فاضل عليك 12,500.00 SAR')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'افتح المدفوعات' })).toBeInTheDocument();
  });

  it('asks the server again every time it opens, so the numbers are fresh', async () => {
    mock.onGet('/workspaces/22/assistant').reply(200, ENABLED);
    const user = userEvent.setup();
    renderWithIntl(<ClientAssistant />);

    const fab = await screen.findByRole('button', { name: 'Shad assistant' });
    const before = mock.history.get.filter((r) => r.url === '/workspaces/22/assistant').length;
    await user.click(fab);

    await waitFor(() => expect(mock.history.get.filter((r) => r.url === '/workspaces/22/assistant').length).toBeGreaterThan(before));
  });
});
