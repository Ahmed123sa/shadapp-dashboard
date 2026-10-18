import { describe, it, expect, beforeEach } from 'vitest';
import { applyUiStyle, getStoredUiStyle, storeUiStyle, UI_STYLE_KEY } from '../ui-style';

describe('ui-style', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.ui;
  });

  it('defaults to classic', () => {
    expect(getStoredUiStyle()).toBe('classic');
  });

  it('persists luxe and reads it back', () => {
    storeUiStyle('luxe');
    expect(window.localStorage.getItem(UI_STYLE_KEY)).toBe('luxe');
    expect(getStoredUiStyle()).toBe('luxe');
  });

  it('treats unknown stored values as classic', () => {
    window.localStorage.setItem(UI_STYLE_KEY, 'neon');
    expect(getStoredUiStyle()).toBe('classic');
  });

  it('sets and clears data-ui on <html>', () => {
    applyUiStyle('luxe');
    expect(document.documentElement.dataset.ui).toBe('luxe');
    applyUiStyle('classic');
    expect(document.documentElement.dataset.ui).toBeUndefined();
  });
});
