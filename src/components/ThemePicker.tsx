import type { CSSProperties } from 'react';
import { THEMES, useTheme } from '../theme';

export default function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return <section className="theme-picker" aria-label="Appearance">
    <div className="theme-heading"><span className="eyebrow">Appearance</span><span>{theme.name}</span></div>
    <div className="theme-options" role="group" aria-label="App color theme">
      {THEMES.map(option => <button key={option.id} type="button" className="theme-option"
        style={{ '--swatch-primary': option.accent, '--swatch-secondary': option.base } as CSSProperties}
        aria-label={`${option.name}: ${option.pair}`} title={`${option.name} · ${option.pair}`}
        aria-pressed={theme.id === option.id} onClick={() => setTheme(option)}><span /></button>)}
    </div>
    <p>Inspired by Autonoma. Made for you.</p>
  </section>;
}
