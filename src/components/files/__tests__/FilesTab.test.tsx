import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import FilesTab from '../FilesTab';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// Characterization suite written BEFORE migrating FilesTab off manual
// useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md Round 3,
// Files slice). Pins down current API calls + rendered/updated state so the
// migration can be checked against this file instead of assumptions.

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
}));

let mock: MockAdapter;

const pendingFile = {
  id: 701,
  workspace_id: 9,
  file_url: '/storage/files/a.pdf',
  name: 'ID Card.pdf',
  type: 'application/pdf',
  size: 20480,
  status: 'pending',
  uploaded_by_type: 'App\\Models\\Client',
  uploaded_by_id: 1,
};

const definition = { id: 1, workspace_id: 9, name: 'ID Card', is_required: true, sort_order: 0 };

function mockLoad(overrides?: { files?: unknown[]; definitions?: unknown[]; paymentFiles?: unknown[] }) {
  mock.onGet('/workspaces/9/files').reply(200, {
    files: overrides?.files ?? [pendingFile],
    definitions: overrides?.definitions ?? [definition],
    paymentFiles: overrides?.paymentFiles ?? [],
  });
}

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('FilesTab (characterization)', () => {
  it('loads files and definitions for the workspace on mount', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad();
    renderWithIntl(<FilesTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('ID Card.pdf')).toBeInTheDocument());
    expect(screen.getByText('ID Card')).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/files')).toBe(true);
  });

  it('shows Accept/Reject only for a super admin on a pending file', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
    mockLoad();
    renderWithIntl(<FilesTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Accept')).toBeInTheDocument());
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('lets a super admin approve a pending file, updating it in place', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'SA', email: 'sa@example.com', role: 'super_admin' });
    mockLoad();
    mock.onPost('/files/701/review').reply(200, { file: { ...pendingFile, status: 'approved' } });

    const user = userEvent.setup();
    renderWithIntl(<FilesTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('Accept')).toBeInTheDocument());
    await user.click(screen.getByText('Accept'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/files/701/review');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({ action: 'approved' });
    });
    await waitFor(() => expect(screen.queryByText('Accept')).not.toBeInTheDocument());
  });

  it('lets a non-super-admin manager upload a file and adds it to the list', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad({ files: [] });
    mock.onPost('/workspaces/9/files').reply(200, {
      file: { id: 900, workspace_id: 9, file_url: '/storage/files/b.pdf', name: 'passport.pdf', type: 'application/pdf', size: 1024, status: 'pending', uploaded_by_type: 'App\\Models\\Client', uploaded_by_id: 1 },
    });

    renderWithIntl(<FilesTab wsId={9} />);
    await waitFor(() => expect(screen.getByText('+ Upload File')).toBeInTheDocument());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'passport.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/files');
      expect(call).toBeTruthy();
    });
    await waitFor(() => expect(screen.getByText('passport.pdf')).toBeInTheDocument());
  });

  it('adds a new document definition and shows it in the tag list', async () => {
    vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
    mockLoad({ definitions: [] });
    mock.onPost('/workspaces/9/document-definitions').reply(200, {
      definition: { id: 2, workspace_id: 9, name: 'Passport', is_required: true, sort_order: 1 },
    });

    const user = userEvent.setup();
    renderWithIntl(<FilesTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('+ Define Document')).toBeInTheDocument());
    await user.click(screen.getByText('+ Define Document'));

    const input = screen.getByPlaceholderText('Document name');
    await user.type(input, 'Passport');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/document-definitions');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({ name: 'Passport' });
    });
    await waitFor(() => expect(screen.getAllByText('Passport', { exact: false }).length).toBeGreaterThan(0));
  });
});
