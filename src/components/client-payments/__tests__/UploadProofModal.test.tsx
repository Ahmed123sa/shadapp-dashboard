import { describe, it, expect, vi } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import api from '@/lib/api';
import { renderWithIntl } from '@/test/render';
import UploadProofModal from '../UploadProofModal';

function renderModal(allowedCurrencies?: string[]) {
  return renderWithIntl(
    <UploadProofModal
      wsId={1}
      availableMethods={['bank_transfer', 'instapay']}
      allowedCurrencies={allowedCurrencies}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />
  );
}

function getCurrencyOptions(): string[] {
  const currencySelect = screen.getAllByRole('combobox')[0];
  return within(currencySelect)
    .getAllByRole('option')
    .map((o) => o.textContent || '');
}

const ALL = ['SAR', 'USD', 'EUR', 'AED', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR'];

describe('UploadProofModal', () => {
  it('limits the currency dropdown to the allowed currencies when provided', () => {
    renderModal(['USD', 'EUR']);
    expect(getCurrencyOptions()).toEqual(['USD', 'EUR']);
  });

  it('falls back to every currency when no allowedCurrencies prop is passed', () => {
    renderModal();
    expect(getCurrencyOptions()).toEqual(ALL);
  });

  it('defaults the selected currency to the first allowed currency', () => {
    renderModal(['USD', 'EUR']);
    const currencySelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(currencySelect.value).toBe('USD');
  });

  it('sends every chosen receipt as proof_files[] (the field the backend reads)', async () => {
    const mock = new MockAdapter(api);
    mock.onPost('/workspaces/1/payments').reply(200, { payment: { id: 1 } });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    const { container } = renderWithIntl(
      <UploadProofModal wsId={1} availableMethods={['instapay']} allowedCurrencies={['EGP']} onClose={vi.fn()} onCreated={onCreated} />
    );

    await user.type(screen.getByLabelText('Amount'), '100');
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'instapay');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    fireEvent.change(input, { target: { files: [new File(['1'], 'a.jpg', { type: 'image/jpeg' }), new File(['2'], 'b.jpg', { type: 'image/jpeg' })] } });
    await user.click(screen.getByRole('button', { name: 'Submit Payment Proof' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const form = mock.history.post[0].data as FormData;
    expect(form.getAll('proof_files[]')).toHaveLength(2);
    expect(form.get('proof_file')).toBeNull();
    mock.restore();
  });
});
