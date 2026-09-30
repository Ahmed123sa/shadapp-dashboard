import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ClientFiles from '../ClientFiles';
import api from '@/lib/api';
import { canDo } from '@/lib/client-auth';

// subuser-review-plan.md م٦ — canDo() is mocked directly (it calls
// hasSubUserPermission() through its own module's closure, so mocking that
// export instead would not be observed here). Defaults to true so the
// pre-existing characterization tests above keep behaving as before.
vi.mock('@/lib/client-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/client-auth')>()),
  canDo: vi.fn(),
}));

// Characterization suite written BEFORE migrating ClientFiles off manual
// useEffect+setState onto TanStack Query (DASHBOARD_ASSESSMENT.md Round 3,
// Files slice). Shares the same `/workspaces/:id/files` endpoint as
// FilesTab, so this pins down the client-facing view's own rendering
// (no review actions, a payment-proofs section, upload via a modal) before
// the two are pointed at a shared cache entry.

let mock: MockAdapter;

const approvedFile = {
  id: 701,
  workspace_id: 9,
  file_url: '/storage/files/a.pdf',
  name: 'ID Card.pdf',
  type: 'application/pdf',
  size: 20480,
  status: 'approved',
  uploaded_by_type: 'App\\Models\\Client',
  uploaded_by_id: 1,
};

const definition = { id: 1, workspace_id: 9, name: 'ID Card', is_required: true, sort_order: 0 };

const paymentProof = {
  id: 501,
  workspace_id: 9,
  payment_id: 1,
  file_url: '/storage/files/proof.pdf',
  name: 'proof.pdf',
  amount: '2500',
  currency: 'SAR',
  status: 'pending',
};

function mockLoad(overrides?: { files?: unknown[]; definitions?: unknown[]; paymentFiles?: unknown[] }) {
  mock.onGet('/workspaces/9/files').reply(200, {
    files: overrides?.files ?? [approvedFile],
    definitions: overrides?.definitions ?? [definition],
    paymentFiles: overrides?.paymentFiles ?? [],
  });
}

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(canDo).mockReturnValue(true);
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('ClientFiles (characterization)', () => {
  it('loads files and definitions for the workspace on mount', async () => {
    mockLoad();
    renderWithIntl(<ClientFiles wsId={9} />);

    await waitFor(() => expect(screen.getByText('ID Card.pdf')).toBeInTheDocument());
    expect(screen.getAllByText('ID Card', { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(mock.history.get.some((r) => r.url === '/workspaces/9/files')).toBe(true);
  });

  it('shows the empty state when there are no files or payment proofs', async () => {
    mockLoad({ files: [] });
    renderWithIntl(<ClientFiles wsId={9} />);

    await waitFor(() => expect(screen.getByText('No files')).toBeInTheDocument());
  });

  it('renders the payment proofs section separately when present', async () => {
    mockLoad({ files: [], paymentFiles: [paymentProof] });
    renderWithIntl(<ClientFiles wsId={9} />);

    await waitFor(() => expect(screen.getByText('Payment Proofs')).toBeInTheDocument());
    expect(screen.getByText('proof.pdf')).toBeInTheDocument();
    expect(screen.getByText('Payment Proof')).toBeInTheDocument();
    expect(screen.getByText('2500 SAR')).toBeInTheDocument();
  });

  it('opens the upload modal, uploads a file, and adds it to the list', async () => {
    mockLoad({ files: [] });
    mock.onPost('/workspaces/9/files').reply(200, {
      file: { id: 900, workspace_id: 9, file_url: '/storage/files/b.pdf', name: 'passport.pdf', type: 'application/pdf', size: 1024, status: 'pending', uploaded_by_type: 'App\\Models\\Client', uploaded_by_id: 1 },
    });

    const user = userEvent.setup();
    renderWithIntl(<ClientFiles wsId={9} />);

    await waitFor(() => expect(screen.getByText('+ Upload Document')).toBeInTheDocument());
    await user.click(screen.getByText('+ Upload Document'));

    await waitFor(() => expect(screen.getByText('Upload Document')).toBeInTheDocument());

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'passport.pdf', { type: 'application/pdf' });
    await user.upload(fileInput, file);

    await user.click(screen.getByText('Upload'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/files');
      expect(call).toBeTruthy();
      const form = call!.data as FormData;
      expect(form.get('file')).toBeInstanceOf(File);
    });
    await waitFor(() => expect(screen.getByText('passport.pdf')).toBeInTheDocument());
    // Modal closes on success.
    expect(screen.queryByText('Upload Document', { selector: 'h3' })).not.toBeInTheDocument();
  });

  // subuser-review-plan.md م٦ — uploading a file maps to can_upload_files;
  // a sub-user without it must not see the upload trigger button at all.
  describe('sub-user action gating (م٦)', () => {
    it('hides the upload trigger button when can_upload_files is false', async () => {
      vi.mocked(canDo).mockReturnValue(false);
      mockLoad();
      renderWithIntl(<ClientFiles wsId={9} />);

      await waitFor(() => expect(screen.getByText('ID Card.pdf')).toBeInTheDocument());
      expect(screen.queryByText('+ Upload Document')).not.toBeInTheDocument();
    });

    it('shows the upload trigger button when can_upload_files is true', async () => {
      vi.mocked(canDo).mockReturnValue(true);
      mockLoad();
      renderWithIntl(<ClientFiles wsId={9} />);

      await waitFor(() => expect(screen.getByText('+ Upload Document')).toBeInTheDocument());
    });
  });
});
