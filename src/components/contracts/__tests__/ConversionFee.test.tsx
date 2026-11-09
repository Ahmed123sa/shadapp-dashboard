import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ContractsTab from '../ContractsTab';
import ContractBuilder from '@/components/chat/ContractBuilder';
import AdsSplit, { hasConversion } from '../AdsSplit';
import { isValidConversionPercentage } from '../AdsFeeField';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// Ads contracts can carry a dollar-conversion fee (a share of the ad budget,
// added on top of the value, never taxed). Any contract can be excluded from tax.
// Reference: value 100,000, fee 10%, budget 90,000, conversion 5% = 4,500.

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

let mock: MockAdapter;

const withConversion = {
  id: 710, workspace_id: 9, title: 'conv cc', status: 'draft', contract_type: 'main',
  value: '100000', currency: 'SAR', clauses: [],
  ads_percentage: 10, ads_amount: 10000, ads_budget: 90000,
  conversion_percentage: 5, conversion_amount: 4500, tax_excluded: false,
};
const adsOnly = { ...withConversion, id: 711, title: 'ads only', conversion_percentage: null, conversion_amount: null };

function mockLoad(contracts: unknown[]) {
  mock.onGet('/workspaces/9/contracts').reply(200, { contracts });
  mock.onGet('/contract-clause-templates').reply(200, { templates: [] });
  mock.onGet('/settings').reply(200, { settings: { show_contract_dates: { value: true } } });
}

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(getUser).mockReturnValue({ id: 1, name: 'Manager', email: 'manager@example.com', role: 'account_manager' });
});

afterEach(() => {
  mock.restore();
  vi.clearAllMocks();
});

describe('conversion helpers', () => {
  it('knows a contract that carries a conversion fee', () => {
    expect(hasConversion(withConversion)).toBe(true);
    expect(hasConversion(adsOnly)).toBe(false);
    expect(hasConversion({ ...withConversion, conversion_amount: 0 })).toBe(false);
    expect(hasConversion(undefined)).toBe(false);
  });

  it('accepts empty, 0 and up to 100 only', () => {
    expect(isValidConversionPercentage('')).toBe(true);
    expect(isValidConversionPercentage('0')).toBe(true);
    expect(isValidConversionPercentage('5')).toBe(true);
    expect(isValidConversionPercentage('100')).toBe(true);
    expect(isValidConversionPercentage('101')).toBe(false);
    expect(isValidConversionPercentage('-1')).toBe(false);
    expect(isValidConversionPercentage('abc')).toBe(false);
  });
});

describe('AdsSplit with a conversion fee', () => {
  it('shows the fee and says the value excludes it, in English and Arabic', () => {
    const { unmount } = renderWithIntl(<AdsSplit ads={withConversion} currency="SAR" />);
    expect(screen.getByTestId('ads-conversion')).toHaveTextContent('Dollar conversion fee (5%)');
    expect(screen.getByTestId('ads-conversion')).toHaveTextContent('4,500 SAR');
    expect(screen.getByText('Contract value excludes the conversion fee')).toBeInTheDocument();
    unmount();

    renderWithIntl(<AdsSplit ads={withConversion} currency="SAR" />, { locale: 'ar' });
    expect(screen.getByText(/رسوم التحويل الدولاري/)).toBeInTheDocument();
    expect(screen.getByText('قيمة العقد غير شاملة رسوم التحويل')).toBeInTheDocument();
  });

  it('draws no conversion line for an ads contract without one', () => {
    renderWithIntl(<AdsSplit ads={adsOnly} />);
    expect(screen.getByTestId('ads-split')).toBeInTheDocument();
    expect(screen.queryByTestId('ads-conversion')).toBeNull();
    expect(screen.queryByText('Contract value excludes the conversion fee')).toBeNull();
  });
});

describe('ContractsTab form', () => {
  async function openForm() {
    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);
    await waitFor(() => expect(screen.getByText('+ + New Contract')).toBeInTheDocument());
    await user.click(screen.getByText('+ + New Contract'));
    await user.type(screen.getByPlaceholderText('Contract title'), 'conv cc');
    return user;
  }

  it('only offers the conversion field once the contract is an ads contract', async () => {
    mockLoad([]);
    const user = await openForm();

    expect(screen.queryByLabelText('Dollar conversion fee (% of ad budget)')).toBeNull();
    await user.click(screen.getByLabelText('Ads contract'));
    expect(screen.getByLabelText('Dollar conversion fee (% of ad budget)')).toBeInTheDocument();
  });

  it('sends the conversion percentage and the tax switch on create', async () => {
    mockLoad([]);
    mock.onPost('/workspaces/9/contracts').reply(200, { contract: withConversion });
    const user = await openForm();

    await user.click(screen.getByLabelText('Ads contract'));
    await user.type(screen.getByLabelText('Ads management fee (%)'), '10');
    await user.type(screen.getByLabelText('Dollar conversion fee (% of ad budget)'), '5');
    await user.click(screen.getByLabelText('Exclude tax'));
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/contracts');
      expect(call).toBeTruthy();
      const body = JSON.parse(call!.data);
      expect(body.ads_percentage).toBe(10);
      expect(body.conversion_percentage).toBe(5);
      expect(body.tax_excluded).toBe(true);
    });
  });

  it('sends neither option for a normal contract', async () => {
    mockLoad([]);
    mock.onPost('/workspaces/9/contracts').reply(200, { contract: adsOnly });
    const user = await openForm();

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/contracts');
      expect(call).toBeTruthy();
      const body = JSON.parse(call!.data);
      expect(body).not.toHaveProperty('conversion_percentage');
      expect(body).not.toHaveProperty('tax_excluded');
    });
  });

  it('treats an empty or zero conversion field as no fee', async () => {
    mockLoad([]);
    mock.onPost('/workspaces/9/contracts').reply(200, { contract: adsOnly });
    const user = await openForm();

    await user.click(screen.getByLabelText('Ads contract'));
    await user.type(screen.getByLabelText('Ads management fee (%)'), '10');
    await user.type(screen.getByLabelText('Dollar conversion fee (% of ad budget)'), '0');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/contracts');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).not.toHaveProperty('conversion_percentage');
    });
  });

  it('blocks a conversion percentage above 100 and says why', async () => {
    mockLoad([]);
    const user = await openForm();

    await user.click(screen.getByLabelText('Ads contract'));
    await user.type(screen.getByLabelText('Ads management fee (%)'), '10');
    await user.type(screen.getByLabelText('Dollar conversion fee (% of ad budget)'), '150');
    await user.click(screen.getByText('Save'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a percentage between 0 and 100.');
    expect(mock.history.post.some((r) => r.url === '/workspaces/9/contracts')).toBe(false);
  });

  it('opens a contract for editing with both options filled in, and clears the fee when ads is turned off', async () => {
    mockLoad([{ ...withConversion, tax_excluded: true }]);
    mock.onPut('/contracts/710').reply(200, { contract: adsOnly });
    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('conv cc')).toBeInTheDocument());
    await user.click(screen.getByText('Edit', { selector: 'button' }));

    expect(screen.getByLabelText('Dollar conversion fee (% of ad budget)')).toHaveValue(5);
    expect(screen.getByLabelText('Exclude tax')).toBeChecked();

    await user.click(screen.getByLabelText('Ads contract'));
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      const call = mock.history.put.find((r) => r.url === '/contracts/710');
      expect(call).toBeTruthy();
      const body = JSON.parse(call!.data);
      expect(body.ads_percentage).toBeNull();
      expect(body.conversion_percentage).toBeNull();
      expect(body.tax_excluded).toBe(true);
    });
  });

  it('lists the conversion fee under an ads contract', async () => {
    mockLoad([withConversion]);
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('conv cc')).toBeInTheDocument());
    expect(screen.getByTestId('ads-conversion')).toHaveTextContent('4,500 SAR');
  });
});

describe('ContractBuilder (extra contract from the chat)', () => {
  it('can make the extra contract an ads contract with a conversion fee and no tax', async () => {
    mock.onGet('/contract-clause-templates').reply(200, { templates: [] });
    mock.onGet('/settings').reply(200, { settings: { show_contract_dates: { value: true } } });
    mock.onPost('/workspaces/9/contracts').reply(200, { contract: withConversion });
    const onCreated = vi.fn();

    const user = userEvent.setup();
    renderWithIntl(<ContractBuilder wsId={9} onCreated={onCreated} onCancel={() => {}} />);

    await user.type(screen.getByPlaceholderText(/title/i), 'Extra ads');
    await user.click(screen.getByLabelText('Ads contract'));
    await user.type(screen.getByLabelText('Ads management fee (%)'), '10');
    await user.type(screen.getByLabelText('Dollar conversion fee (% of ad budget)'), '5');
    await user.click(screen.getByLabelText('Exclude tax'));
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/contracts');
      expect(call).toBeTruthy();
      const body = JSON.parse(call!.data);
      expect(body.ads_percentage).toBe(10);
      expect(body.conversion_percentage).toBe(5);
      expect(body.tax_excluded).toBe(true);
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it('stays a normal contract when the ads box is not ticked', async () => {
    mock.onGet('/contract-clause-templates').reply(200, { templates: [] });
    mock.onGet('/settings').reply(200, { settings: { show_contract_dates: { value: true } } });
    mock.onPost('/workspaces/9/contracts').reply(200, { contract: adsOnly });

    const user = userEvent.setup();
    renderWithIntl(<ContractBuilder wsId={9} onCreated={() => {}} onCancel={() => {}} />);

    await user.type(screen.getByPlaceholderText(/title/i), 'Extra plain');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/contracts');
      expect(call).toBeTruthy();
      const body = JSON.parse(call!.data);
      expect(body).not.toHaveProperty('ads_percentage');
      expect(body).not.toHaveProperty('conversion_percentage');
      expect(body).not.toHaveProperty('tax_excluded');
    });
  });
});
