import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import AccountManagersPage from '../page';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
  isAuthenticated: vi.fn(() => true),
}));

let mock: MockAdapter;

const sara = { id: 7, name: 'Sara Manager', email: 'sara@example.com', phone: '+20100', is_active: true, can_approve_contracts: false, managed_clients_count: 3 };

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' } as any);
});

afterEach(() => {
  mock.restore();
  delete document.documentElement.dataset.ui;
  vi.clearAllMocks();
});

describe('AccountManagersPage', () => {
  it('lists managers (classic look)', async () => {
    mock.onGet(/\/account-managers/).reply(200, { managers: [sara] });
    renderWithIntl(<AccountManagersPage />);
    expect(await screen.findByText('Sara Manager')).toBeInTheDocument();
    expect(screen.getByText('sara@example.com')).toBeInTheDocument();
  });

  it('the edit-form checkbox label no longer carries the signature sentence', async () => {
    mock.onGet(/\/account-managers/).reply(200, { managers: [sara] });
    renderWithIntl(<AccountManagersPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Can approve contracts')).toBeInTheDocument();
    expect(screen.queryByText(/company signature/i)).not.toBeInTheDocument();
  });

  describe('Luxe approve switch', () => {
    beforeEach(() => {
      document.documentElement.dataset.ui = 'luxe';
    });

    it('sends only the flag and flips on success', async () => {
      mock.onGet(/\/account-managers/).reply(200, { managers: [sara] });
      mock.onPut('/account-managers/7').reply(200, { manager: { ...sara, can_approve_contracts: true } });
      renderWithIntl(<AccountManagersPage />);

      const sw = await screen.findByRole('switch', { name: /Can approve contracts/ });
      expect(sw).toHaveAttribute('aria-checked', 'false');
      await userEvent.click(sw);

      await waitFor(() => expect(mock.history.put.length).toBe(1));
      expect(JSON.parse(mock.history.put[0].data)).toEqual({ can_approve_contracts: true });
      await waitFor(() => expect(screen.getByRole('switch', { name: /Can approve contracts/ })).toHaveAttribute('aria-checked', 'true'));
    });

    it('rolls back and shows the error when the request fails', async () => {
      mock.onGet(/\/account-managers/).reply(200, { managers: [sara] });
      mock.onPut('/account-managers/7').reply(422, { message: 'nope' });
      renderWithIntl(<AccountManagersPage />);

      const sw = await screen.findByRole('switch', { name: /Can approve contracts/ });
      await userEvent.click(sw);

      expect(await screen.findByText('nope')).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /Can approve contracts/ })).toHaveAttribute('aria-checked', 'false');
    });
  });
});
