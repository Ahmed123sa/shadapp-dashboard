import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ContractBuilder from '../ContractBuilder';
import api from '@/lib/api';

// Characterization suite written BEFORE migrating ContractBuilder's
// templates/settings loading off manual useEffect+setState onto TanStack
// Query (DASHBOARD_ASSESSMENT.md Round 3, Contracts slice). This component
// is rendered inside ChatTab (still unmigrated, deferred separately for its
// polling+websocket complexity) but its own data fetching is self-contained
// and independently migratable.

let mock: MockAdapter;

function mockLoad(overrides?: { templates?: unknown[] }) {
  mock.onGet('/contract-clause-templates').reply(200, {
    templates: overrides?.templates ?? [
      { id: 1, content: 'Fixed clause one', type: 'fixed' },
      { id: 2, content: 'Optional clause one', type: 'optional' },
    ],
  });
  mock.onGet('/settings').reply(200, { settings: { show_contract_dates: { value: true } } });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ContractBuilder (characterization)', () => {
  it('loads clause templates and the show-dates setting on mount', async () => {
    mockLoad();
    renderWithIntl(<ContractBuilder wsId={9} onCreated={vi.fn()} onCancel={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Fixed clause one')).toBeInTheDocument());
    expect(screen.getByText('Optional clause one')).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/contract-clause-templates')).toBe(true);
    expect(mock.history.get.some((r) => r.url === '/settings')).toBe(true);
  });

  it('creates a contract with the entered title and calls onCreated', async () => {
    mockLoad();
    mock.onPost('/workspaces/9/contracts').reply(200, {
      contract: { id: 900, workspace_id: 9, title: 'Extra Service', status: 'draft', clauses: [] },
    });
    const onCreated = vi.fn();

    const user = userEvent.setup();
    renderWithIntl(<ContractBuilder wsId={9} onCreated={onCreated} onCancel={vi.fn()} />);

    await waitFor(() => expect(screen.getByPlaceholderText('Contract title')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('Contract title'), 'Extra Service');
    await user.click(screen.getByText('Create & Send'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/contracts');
      expect(call).toBeTruthy();
      const body = JSON.parse(call!.data);
      expect(body.title).toBe('Extra Service');
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 900, title: 'Extra Service' })));
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    mockLoad();
    const onCancel = vi.fn();

    const user = userEvent.setup();
    renderWithIntl(<ContractBuilder wsId={9} onCreated={vi.fn()} onCancel={onCancel} />);

    await waitFor(() => expect(screen.getByText('Cancel')).toBeInTheDocument());
    await user.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
  });
});
