import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/test/render';
import LocationPickerModal from '../LocationPickerModal';

// The real map is Leaflet, which touches window/DOM measurement APIs jsdom
// doesn't implement — swapped for a trivial stand-in that exposes a button
// to simulate a marker move (map click / drag), which is all this modal's
// own logic (the reverse-geocode call and the search-skip flag) cares about.
vi.mock('../LocationPickerMap', () => ({
  default: ({ onChange }: { onChange: (lat: number, lng: number) => void }) => (
    <button onClick={() => onChange(30.111111, 31.222222)}>simulate map move</button>
  ),
}));

async function findFakeMap() {
  return screen.findByText('simulate map move');
}

// The address <label> is programmatically associated with the <textarea>
// via htmlFor/id, so it's reachable by its accessible name.
function addressField() {
  return screen.getByLabelText('Address') as HTMLTextAreaElement;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LocationPickerModal', () => {
  it('pre-fills the address textarea from initialAddress', async () => {
    renderWithIntl(
      <LocationPickerModal initialAddress="12 Tahrir St, Cairo" onConfirm={() => {}} onClose={() => {}} />
    );
    await findFakeMap();
    expect(addressField()).toHaveValue('12 Tahrir St, Cairo');
  });

  it('reverse-geocodes and fills the address when the map position changes', async () => {
    (global.fetch as any).mockResolvedValue({
      json: () => Promise.resolve({ display_name: '10 Nile Corniche, Cairo' }),
    });
    renderWithIntl(<LocationPickerModal onConfirm={() => {}} onClose={() => {}} />);
    const map = await findFakeMap();

    await userEvent.click(map);

    await waitFor(() => {
      expect(addressField()).toHaveValue('10 Nile Corniche, Cairo');
    });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('nominatim.openstreetmap.org/reverse'));
  });

  it('searching for a place sets the address and skips the follow-up reverse geocode', async () => {
    (global.fetch as any).mockResolvedValue({
      json: () =>
        Promise.resolve([{ lat: '30.5', lon: '31.5', display_name: 'Found Place, Egypt' }]),
    });
    const user = userEvent.setup();
    renderWithIntl(<LocationPickerModal onConfirm={() => {}} onClose={() => {}} />);
    await findFakeMap();

    await user.type(screen.getByPlaceholderText('Search for an address or place...'), 'found place');
    await user.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(addressField()).toHaveValue('Found Place, Egypt');
    });
    // Search resolves the address itself — a real map would fire onChange
    // for the same point right after, and that follow-up reverse-geocode
    // call must be skipped, so fetch should have been called exactly once.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('nominatim.openstreetmap.org/search'));
  });

  it('shows a "no results" message when the search comes back empty', async () => {
    (global.fetch as any).mockResolvedValue({ json: () => Promise.resolve([]) });
    const user = userEvent.setup();
    renderWithIntl(<LocationPickerModal onConfirm={() => {}} onClose={() => {}} />);
    await findFakeMap();

    await user.type(screen.getByPlaceholderText('Search for an address or place...'), 'nowhere');
    await user.click(screen.getByText('Search'));

    expect(await screen.findByText('No results found.')).toBeInTheDocument();
  });

  it('shows a failure message when the search request itself throws', async () => {
    (global.fetch as any).mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderWithIntl(<LocationPickerModal onConfirm={() => {}} onClose={() => {}} />);
    await findFakeMap();

    await user.type(screen.getByPlaceholderText('Search for an address or place...'), 'anywhere');
    await user.click(screen.getByText('Search'));

    expect(await screen.findByText('Search failed. Try again.')).toBeInTheDocument();
  });

  it('disables Save location until a point is selected, then confirms with trimmed address', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithIntl(<LocationPickerModal onConfirm={onConfirm} onClose={() => {}} />);
    const map = await findFakeMap();

    expect(screen.getByText('Save location').closest('button')).toBeDisabled();

    await user.click(map);
    const textarea = addressField();
    await user.clear(textarea);
    await user.type(textarea, '  Nice address  ');
    await user.click(screen.getByText('Save location'));

    expect(onConfirm).toHaveBeenCalledWith(30.111111, 31.222222, 'Nice address');
  });

  it('closes on backdrop click but not on a click inside the dialog', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = renderWithIntl(<LocationPickerModal onConfirm={() => {}} onClose={onClose} />);
    await findFakeMap();

    await user.click(screen.getByText('Set client location'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(container.firstElementChild as Element); // the backdrop itself
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
