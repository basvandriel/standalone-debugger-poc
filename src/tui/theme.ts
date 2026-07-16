// Mirrors the Electron renderer's theme.css palette for visual consistency
// across both frontends.
export const COLORS = {
  bg: '#0a0c10',
  panel: '#13161c',
  panelRaised: '#171c24',
  panelHeader: '#191d25',
  fg: '#e2e5ea',
  fgDim: '#767e8c',
  fgMuted: '#5d6675',
  border: '#262b34',
  borderSubtle: '#1b1f27',
  accent: '#5fb3ff',
  accentDim: '#2c4a63',
  accentSoft: '#1d2c3b',
  success: '#6bcf6b',
  successDim: '#1e3320',
  error: '#ff6b6b',
  errorDim: '#3a1f22',
  warn: '#e0c26b',
  warnDim: '#3a331c',
  selectionBg: '#22344a',
  selectionSoft: '#1c2d40'
} as const;
