import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import LoginAttemptsPanel from '../LoginAttemptsPanel';
import api from '@/lib/api';

// The read side of login_attempts. Before this panel the table was
// write-only — rows were collected correctly but only reachable with direct
// database access, which left the support question it was built for ("why
// can't this person log in") exactly as unanswerable as before.

let mock: MockAdapter;

const attempt = {
  id: 1,
  email: 'someone@acme.com',
  ip_address: '203.0.113.9',
  endpoint: 'client',
  reason: 'wrong_password',
  created_at: '2026-09-20T10:30:00Z',
};

function mockList(data: unknown[] = [attempt], total = data.length) {
  mock.onGet(/\/login-attempts/).reply(200, {
    attempts: { data, last_page: 1, total },
  });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('LoginAttemptsPanel', () => {
  it('loads attempts on mount and shows the email and IP', async () => {
    mockList();

    renderWithIntl(<LoginAttemptsPanel />);

    expect(await screen.findByText('someone@acme.com')).toBeInTheDocument();
    expect(screen.getByText('203.0.113.9')).toBeInTheDocument();
  });

  // Every reason label also appears as an <option> in the filter dropdown,
  // so these have to be scoped to the table — an unscoped getByText matches
  // both and throws. (The first draft of these tests passed by accident on
  // whichever label happened to be asserted before the rows finished
  // loading, while the dropdown was already on screen.)
  //
  // The reason column is the entire point of this table: it separates "no
  // such account" from "wrong password" from "archived", a distinction the
  // API deliberately never makes to the person signing in.
  it('translates the reason code rather than showing the raw value', async () => {
    mockList();

    renderWithIntl(<LoginAttemptsPanel />);

    const table = within(await screen.findByRole('table'));
    expect(table.getByText('Wrong password')).toBeInTheDocument();
    expect(table.queryByText('wrong_password')).not.toBeInTheDocument();
  });

  it('renders each reason with its own label', async () => {
    mockList([
      { ...attempt, id: 1, reason: 'unknown_email' },
      { ...attempt, id: 2, reason: 'account_inactive' },
      { ...attempt, id: 3, reason: 'client_archived' },
    ]);

    renderWithIntl(<LoginAttemptsPanel />);

    const table = within(await screen.findByRole('table'));
    expect(table.getByText('No such account')).toBeInTheDocument();
    expect(table.getByText('Account deactivated')).toBeInTheDocument();
    expect(table.getByText('Client archived')).toBeInTheDocument();
  });

  it('shows the empty state when there is nothing to show', async () => {
    mockList([], 0);

    renderWithIntl(<LoginAttemptsPanel />);

    expect(await screen.findByText('No failed sign-in attempts')).toBeInTheDocument();
  });

  it('sends the reason filter to the server when applied', async () => {
    mockList();
    renderWithIntl(<LoginAttemptsPanel />);
    await screen.findByText('someone@acme.com');

    await userEvent.selectOptions(screen.getByRole('combobox'), 'client_archived');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const last = mock.history.get[mock.history.get.length - 1];
      expect(last.url).toContain('reason=client_archived');
    });
  });

  it('sends the email search to the server when applied', async () => {
    mockList();
    renderWithIntl(<LoginAttemptsPanel />);
    await screen.findByText('someone@acme.com');

    await userEvent.type(screen.getByPlaceholderText('Search by email'), 'acme');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const last = mock.history.get[mock.history.get.length - 1];
      expect(last.url).toContain('search=acme');
    });
  });

  // The email is attacker-controlled: anyone can POST any string to the
  // login endpoint and have it stored, so it must render as inert text.
  it('renders an attacker-controlled email as text, not markup', async () => {
    mockList([{ ...attempt, email: '<img src=x onerror="window.__pwned = true">' }]);

    renderWithIntl(<LoginAttemptsPanel />);

    expect(await screen.findByText('<img src=x onerror="window.__pwned = true">')).toBeInTheDocument();
    expect(document.querySelectorAll('img').length).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__pwned).toBeUndefined();
  });
});
