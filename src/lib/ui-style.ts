/**
 * Staged redesign switch (DESIGN_REVAMP_PLAN.md).
 *
 * 'classic' = the current look, untouched. 'luxe' = the new look, applied
 * purely through CSS under `html[data-ui="luxe"]` in globals.css. When the
 * client settles on one look, the other branch is deleted (see the plan).
 *
 * Kept separate from the light/dark `shadapp-theme` key: they are
 * independent choices.
 */
export type UiStyle = 'classic' | 'luxe';

export const UI_STYLE_KEY = 'shadapp-ui';

export function getStoredUiStyle(): UiStyle {
  if (typeof window === 'undefined') return 'classic';
  try {
    return window.localStorage.getItem(UI_STYLE_KEY) === 'luxe' ? 'luxe' : 'classic';
  } catch {
    return 'classic';
  }
}

export function storeUiStyle(style: UiStyle): void {
  try {
    window.localStorage.setItem(UI_STYLE_KEY, style);
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
}

/** Sets/clears the attribute on <html> so portals and modals follow too. */
export function applyUiStyle(style: UiStyle): void {
  if (typeof document === 'undefined') return;
  if (style === 'luxe') document.documentElement.dataset.ui = 'luxe';
  else delete document.documentElement.dataset.ui;
}
