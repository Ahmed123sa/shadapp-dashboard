import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import api from '@/lib/api';
import ClientSignature from '../ClientSignature';
import type { Client } from '@/types';

let mock: MockAdapter;

const unsigned = { id: 7, company_name: 'Acme', signed_at: undefined } as unknown as Client;
const PNG = 'data:image/png;base64,AAEC';

// jsdom has no canvas; a recording stub is enough for what the component does.
const ctxStub = {
  clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
  stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(), drawImage: vi.fn(),
} as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctxStub as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(PNG);
});
afterEach(() => {
  mock.restore();
  vi.restoreAllMocks();
});

describe('ClientSignature', () => {
  it('starts in draw mode with Save disabled until something is drawn', () => {
    renderWithIntl(<ClientSignature clientId={7} clientData={unsigned} />);
    expect(screen.getByRole('tab', { name: 'Draw' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Save signature' })).toBeDisabled();
  });

  it('draws with the pointer, then posts the PNG as signature_image', async () => {
    mock.onPost('/clients/7/sign').reply(200, { client: { id: 7 } });
    const onSigned = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<ClientSignature clientId={7} clientData={unsigned} onSigned={onSigned} />);

    const pad = screen.getByRole('img', { name: 'Signature drawing area' });
    fireEvent.pointerDown(pad, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });

    const save = screen.getByRole('button', { name: 'Save signature' });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() => expect(onSigned).toHaveBeenCalled());
    const form = mock.history.post[0].data as FormData;
    const file = form.get('signature_image') as File;
    expect(file.type).toBe('image/png');
    expect(form.get('signature')).toBeNull();
  });

  it('Clear removes the drawing and disables Save again', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ClientSignature clientId={7} clientData={unsigned} />);

    const pad = screen.getByRole('img', { name: 'Signature drawing area' });
    fireEvent.pointerDown(pad, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    await user.click(await screen.findByRole('button', { name: 'Clear' }));

    expect(screen.getByRole('button', { name: 'Save signature' })).toBeDisabled();
  });

  it('typed signatures post the text as `signature`', async () => {
    mock.onPost('/clients/7/sign').reply(200, { client: { id: 7 } });
    const onSigned = vi.fn();
    const user = userEvent.setup();
    renderWithIntl(<ClientSignature clientId={7} clientData={unsigned} onSigned={onSigned} />);

    await user.click(screen.getByRole('tab', { name: 'Type' }));
    await user.type(screen.getByLabelText('Type'), 'Mona Fathy');
    await user.click(screen.getByRole('button', { name: 'Save signature' }));

    await waitFor(() => expect(onSigned).toHaveBeenCalled());
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ signature: 'Mona Fathy' });
  });

  it('rejects a non-PNG upload with a message', async () => {
    renderWithIntl(<ClientSignature clientId={7} clientData={unsigned} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Upload' }));

    const input = screen.getByTestId('sig-file');
    fireEvent.change(input, { target: { files: [new File(['x'], 'sig.jpg', { type: 'image/jpeg' })] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Only PNG images are accepted.');
    expect(screen.getByRole('button', { name: 'Save signature' })).toBeDisabled();
  });

  it('shows the saved signature and deletes it after confirming', async () => {
    mock.onDelete('/clients/7/sign').reply(200, {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSigned = vi.fn();
    const user = userEvent.setup();
    const signed = { id: 7, signed_at: '2026-01-01', signature_data: 'Mona Fathy' } as unknown as Client;
    renderWithIntl(<ClientSignature clientId={7} clientData={signed} onSigned={onSigned} />);

    expect(screen.getByText('Mona Fathy')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Delete/ }));

    await waitFor(() => expect(mock.history.delete.length).toBe(1));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Draw' })).toBeInTheDocument());
    expect(onSigned).toHaveBeenCalled();
  });

  it('does not delete when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const signed = { id: 7, signed_at: '2026-01-01', signature_data: 'Mona Fathy' } as unknown as Client;
    renderWithIntl(<ClientSignature clientId={7} clientData={signed} />);

    await user.click(screen.getByRole('button', { name: /Delete/ }));
    expect(mock.history.delete.length).toBe(0);
  });
});
