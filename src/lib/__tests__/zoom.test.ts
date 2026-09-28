import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import api from '../api';
import { enterMeeting } from '../zoom';

describe('enterMeeting', () => {
  let mockApi: MockAdapter;
  let mockTab: { location: { href: string }; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockApi = new MockAdapter(api);
    mockTab = {
      location: { href: '' },
      close: vi.fn(),
    };
    vi.stubGlobal('window', {
      open: vi.fn(() => mockTab),
      location: { href: '' },
    });
  });

  afterEach(() => {
    mockApi.restore();
    vi.unstubAllGlobals();
  });

  it('opens blank tab synchronously, calls /meetings/:id/enter, and redirects as host', async () => {
    mockApi.onPost('/meetings/42/enter').reply(200, {
      as: 'host',
      url: 'https://zoom.us/s/12345?zak=token1',
    });

    const result = await enterMeeting(42);

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(mockTab.location.href).toBe('https://zoom.us/s/12345?zak=token1');
    expect(result).toBe('host');
  });

  it('redirects participant to join_url and returns participant', async () => {
    mockApi.onPost('/meetings/42/enter').reply(200, {
      as: 'participant',
      url: 'https://zoom.us/j/12345',
    });

    const result = await enterMeeting(42);

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(mockTab.location.href).toBe('https://zoom.us/j/12345');
    expect(result).toBe('participant');
  });

  it('closes blank tab and throws error when API fails', async () => {
    mockApi.onPost('/meetings/42/enter').reply(502, {
      message: 'Zoom unavailable',
    });

    await expect(enterMeeting(42)).rejects.toThrow();
    expect(mockTab.close).toHaveBeenCalled();
  });
});
