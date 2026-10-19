import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import api from '@/lib/api';
import * as clientAuth from '@/lib/client-auth';
import ClientTeamPage from '../page';
import ClientSignaturePage from '../../signature/page';

vi.mock('@/lib/echo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/echo')>()),
  subscribeToNotifications: vi.fn(() => vi.fn()),
  disconnectEcho: vi.fn(),
}));
vi.mock('@/lib/client-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/client-auth')>()),
  isClientAuthenticated: vi.fn(),
  getClient: vi.fn(),
  clientLogout: vi.fn(),
  isSubUser: vi.fn(),
  hasSubUserPermission: vi.fn(),
  getSubUser: vi.fn(),
}));
const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/client-dashboard/team',
}));
// The pages' bodies have their own suites; stub them to test the gate + shell.
vi.mock('@/components/client-subusers/ClientSubUsers', () => ({ default: () => <div>team-body</div> }));
vi.mock('@/components/client-signature/ClientSignature', () => ({ default: () => <div>signature-body</div> }));

let mock: MockAdapter;
const session = { id: 7, company_name: 'Acme Corp', contact_person: 'Jane', email: 'jane@acme.com', status: 'active' };

function load(wsStatus: 'active' | 'inactive') {
  mock.onGet('/clients/7').reply(200, { client: { id: 7, company_name: 'Acme Corp', contact_person: 'Jane', signed_at: '2026-01-01', workspace: { id: 22 } } });
  mock.onGet('/workspaces/22').reply(200, { workspace: { id: 22, status: wsStatus, contracts: [], payments: [] } });
  mock.onAny().reply(200, {});
}

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(clientAuth.isClientAuthenticated).mockReturnValue(true);
  vi.mocked(clientAuth.getClient).mockReturnValue(session as any);
  vi.mocked(clientAuth.isSubUser).mockReturnValue(false);
  vi.mocked(clientAuth.hasSubUserPermission).mockReturnValue(true);
  vi.mocked(clientAuth.getSubUser).mockReturnValue(null);
});
afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe.each([
  ['team', ClientTeamPage, 'team-body', 'My team'],
  ['signature', ClientSignaturePage, 'signature-body', 'Signature'],
])('%s page', (_name, Page, body, title) => {
  it('renders inside the shell for the owner once the workspace is active', async () => {
    load('active');
    renderWithIntl(<Page />);

    await waitFor(() => expect(screen.getByText(body)).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: new RegExp(title) })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends the user back to the workspace until it is active', async () => {
    load('inactive');
    renderWithIntl(<Page />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/client-dashboard'));
    expect(screen.queryByText(body)).not.toBeInTheDocument();
  });

  it('sends an assistant away — owner only', async () => {
    vi.mocked(clientAuth.isSubUser).mockReturnValue(true);
    vi.mocked(clientAuth.getSubUser).mockReturnValue({ id: 5, name: 'Employee', permissions: {} } as any);
    load('active');
    renderWithIntl(<Page />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/client-dashboard'));
    expect(screen.queryByText(body)).not.toBeInTheDocument();
  });

  it('redirects to the client login when not signed in', async () => {
    vi.mocked(clientAuth.isClientAuthenticated).mockReturnValue(false);
    vi.mocked(clientAuth.getClient).mockReturnValue(null);
    renderWithIntl(<Page />);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/client-login'));
  });
});
