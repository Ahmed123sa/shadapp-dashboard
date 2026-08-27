import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getLocale, setLocaleCookie, useLocale } from '../locale';

function clearCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
}

afterEach(clearCookies);

describe('getLocale / setLocaleCookie', () => {
  it('defaults to "en" when no cookie is set', () => {
    expect(getLocale()).toBe('en');
  });

  it('reads back a locale written by setLocaleCookie', () => {
    setLocaleCookie('ar');
    expect(getLocale()).toBe('ar');
  });
});

describe('useLocale', () => {
  it('picks up the current cookie value after mount', () => {
    setLocaleCookie('ar');
    const { result } = renderHook(() => useLocale());
    expect(result.current.locale).toBe('ar');
  });

  it('switchLocale writes the cookie and updates state', () => {
    const { result } = renderHook(() => useLocale());

    // jsdom does not implement navigation, so window.location.reload would
    // throw "not implemented" — stub it the same way the real browser
    // reload is a side effect we don't want running in a test.
    const reloadSpy = () => {};
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });

    act(() => {
      result.current.switchLocale('ar');
    });

    expect(getLocale()).toBe('ar');
    expect(result.current.locale).toBe('ar');
  });
});
