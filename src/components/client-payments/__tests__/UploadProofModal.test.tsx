import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
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
});