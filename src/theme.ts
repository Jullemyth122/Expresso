import { useSyncExternalStore } from 'react';

// Palette values match Autonoma/src/ui/orb/themes.ts. Preferences are local to Expresso.
export const THEMES = [
  { id: 'solar', name: 'Solar', pair: 'Yellow + Blue', base: '#2495ff', accent: '#ffd447', hot: '#d7eeff' },
  { id: 'aurora', name: 'Aurora', pair: 'Violet + Cyan', base: '#9d78ff', accent: '#45edff', hot: '#eee5ff' },
  { id: 'mint', name: 'Mint', pair: 'Mint + Blue', base: '#398bff', accent: '#64ffc1', hot: '#dcfff3' },
  { id: 'sunset', name: 'Sunset', pair: 'Coral + Gold', base: '#ff667f', accent: '#ffcf69', hot: '#ffebe0' },
  { id: 'nebula', name: 'Nebula', pair: 'Pink + Violet', base: '#9174ff', accent: '#ff79d7', hot: '#fce3ff' },
  { id: 'glacier', name: 'Glacier', pair: 'Ice + Blue', base: '#408bff', accent: '#b4f3ff', hot: '#effcff' },
  { id: 'voltage', name: 'Voltage', pair: 'Lime + Violet', base: '#a27bff', accent: '#d4ff54', hot: '#efffd9' },
  { id: 'ember', name: 'Ember', pair: 'Orange + Cyan', base: '#26c8f5', accent: '#ff9b45', hot: '#ffecd9' },
] as const;
type Theme = (typeof THEMES)[number];
const KEY = 'expresso.theme';
function readTheme() {
  try { return THEMES.find(theme => theme.id === localStorage.getItem(KEY)) ?? THEMES[0]; }
  catch { return THEMES[0]; }
}
let current = readTheme();
const listeners = new Set<() => void>();
function apply(theme: Theme) {
  current = theme;
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.style.setProperty('--theme-primary', theme.accent);
  document.documentElement.style.setProperty('--theme-secondary', theme.base);
  document.documentElement.style.setProperty('--theme-highlight', theme.hot);
  listeners.forEach(listener => listener());
}
apply(current);
window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) apply(readTheme()); });
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current);
  return { theme, setTheme: (next: Theme) => { try { localStorage.setItem(KEY, next.id); } catch { /* Session preference still applies. */ } apply(next); } };
}
