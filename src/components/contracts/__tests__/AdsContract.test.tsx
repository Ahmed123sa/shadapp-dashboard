import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import ContractsTab from '../ContractsTab';
import AdsSplit, { hasAds } from '../AdsSplit';
import { isValidAdsPercentage } from '../AdsFeeField';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

// Ads contracts: the agency's fee is a share of the contract value, so the
// split is only shown; the value, the tax and the total never change.

vi.mock('@/lib/auth', () => ({ getUser: vi.fn() }));

let mock: MockAdapter;

const normal = {
  id: 701, workspace_id: 9, title: 'Plain Retainer', status: 'draft', contract_type: 'main',
  value: '10000', currency: 'SAR', clauses: [],
  ads_percentage: null, ads_amount: null, ads_budget: null,
};
const adsContract = {
  id: 702, workspace_id: 9, title: 'ad cc', status: 'draft', contract_type: 'main',
  value: '10000', currency: 'SAR', clauses: [],
  ads_percentage: 10, ads_amount: 1000, ads_budget: 9000,
};

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

describe('ads helpers', () => {
  it('knows an ads contract from a normal one', () => {
    expect(hasAds(adsContract)).toBe(true);
    expect(hasAds(normal)).toBe(false);
    expect(hasAds(undefined)).toBe(false);
  });

  it('accepts only 0.01 to 100', () => {
    expect(isValidAdsPercentage('')).toBe(false);
    expect(isValidAdsPercentage('0')).toBe(false);
    expect(isValidAdsPercentage('101')).toBe(false);
    expect(isValidAdsPercentage('abc')).toBe(false);
    expect(isValidAdsPercentage('0.01')).toBe(true);
    expect(isValidAdsPercentage('20')).toBe(true);
    expect(isValidAdsPercentage('100')).toBe(true);
  });

  it('renders the fee and the budget in English and Arabic, and nothing for a normal contract', () => {
    const { unmount } = renderWithIntl(<AdsSplit ads={adsContract} currency="SAR" />);
    expect(screen.getByText(/Ads management fee \(10%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Ad budget/)).toBeInTheDocument();
    expect(screen.getByText(/1,000 SAR/)).toBeInTheDocument();
    expect(screen.getByText(/9,000 SAR/)).toBeInTheDocument();
    unmount();

    renderWithIntl(<AdsSplit ads={adsContract} currency="SAR" />, { locale: 'ar' });
    expect(screen.getByText(/نسبة إدارة الإعلانات/)).toBeInTheDocument();
    expect(screen.getByText(/ميزانية الإعلانات/)).toBeInTheDocument();
  });

  it('draws nothing for a normal contract', () => {
    renderWithIntl(<AdsSplit ads={normal} />);
    expect(screen.queryByTestId('ads-split')).toBeNull();
  });
});

describe('ContractsTab with ads contracts', () => {
  it('shows the split and the badge on an ads contract only', async () => {
    mockLoad([normal, adsContract]);
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('ad cc')).toBeInTheDocument());
    expect(screen.getAllByTestId('ads-split')).toHaveLength(1);
    expect(screen.getAllByTestId('ads-badge')).toHaveLength(1);
    expect(screen.getByText(/9,000 SAR/)).toBeInTheDocument();
  });

  it('creates an ads contract with its percentage', async () => {
    mockLoad([]);
    mock.onPost('/workspaces/9/contracts').reply(200, { contract: { ...adsContract, id: 800 } });

    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('+ + New Contract')).toBeInTheDocument());
    await user.click(screen.getByText('+ + New Contract'));
    await user.type(screen.getByPlaceholderText('Contract title'), 'ad cc');
    await user.click(screen.getByLabelText('Ads contract'));
    await user.type(screen.getByLabelText('Ads management fee (%)'), '10');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/contracts');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data).ads_percentage).toBe(10);
    });
  });

  it('does not send a percentage for a normal contract', async () => {
    mockLoad([]);
    mock.onPost('/workspaces/9/contracts').reply(200, { contract: { ...normal, id: 801 } });

    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('+ + New Contract')).toBeInTheDocument());
    await user.click(screen.getByText('+ + New Contract'));
    await user.type(screen.getByPlaceholderText('Contract title'), 'Plain');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      const call = mock.history.post.find((r) => r.url === '/workspaces/9/contracts');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).not.toHaveProperty('ads_percentage');
    });
  });

  it('blocks saving an ads contract without a valid percentage and says why', async () => {
    mockLoad([]);

    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('+ + New Contract')).toBeInTheDocument());
    await user.click(screen.getByText('+ + New Contract'));
    await user.type(screen.getByPlaceholderText('Contract title'), 'ad cc');
    await user.click(screen.getByLabelText('Ads contract'));
    await user.click(screen.getByText('Save'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a percentage between 0.01 and 100.');
    expect(mock.history.post.some((r) => r.url === '/workspaces/9/contracts')).toBe(false);
  });

  it('opens an ads contract for editing with its percentage and can turn it back into a normal one', async () => {
    mockLoad([adsContract]);
    mock.onPut('/contracts/702').reply(200, { contract: { ...adsContract, ads_percentage: null, ads_amount: null, ads_budget: null } });

    const user = userEvent.setup();
    renderWithIntl(<ContractsTab wsId={9} />);

    await waitFor(() => expect(screen.getByText('ad cc')).toBeInTheDocument());
    await user.click(screen.getByText('Edit', { selector: 'button' }));

    expect(screen.getByLabelText('Ads contract')).toBeChecked();
    expect(screen.getByLabelText('Ads management fee (%)')).toHaveValue(10);

    await user.click(screen.getByLabelText('Ads contract'));
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      const call = mock.history.put.find((r) => r.url === '/contracts/702');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data).ads_percentage).toBeNull();
    });
  });
});
