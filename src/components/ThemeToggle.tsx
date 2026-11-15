import React from 'react';
import { Monitor, Sun, Moon } from 'lucide-react';
import { useTheme, type ThemePreference } from '../context/ThemeContext';

const THEME_OPTIONS: Record<ThemePreference, { label: string; next: string; Icon: typeof Monitor }> = {
  system: { label: 'System theme', next: 'light', Icon: Monitor },
  light: { label: 'Light theme', next: 'dark', Icon: Sun },
  dark: { label: 'Dark theme', next: 'system', Icon: Moon },
};

/** Cycles the colour theme: system → light → dark. */
export const ThemeToggle: React.FC = () => {
  const { preference, cyclePreference } = useTheme();
  const { label, next, Icon } = THEME_OPTIONS[preference];
  const title = `${label} (click for ${next})`;
  return (
    <button
      type="button"
      onClick={cyclePreference}
      aria-label={title}
      title={title}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '999px', background: 'var(--surface-2)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, flexShrink: 0 }}
    >
      <Icon size={16} />
    </button>
  );
};

/** Three-way theme switch (system / light / dark) used on the account page. */
export const ThemeSwitch: React.FC = () => {
  const { preference, setPreference } = useTheme();
  return (
    <div className="seg" role="group" aria-label="Theme">
      {(['system', 'light', 'dark'] as ThemePreference[]).map((p) => {
        const { label, Icon } = THEME_OPTIONS[p];
        return (
          <button key={p} type="button" aria-pressed={preference === p} aria-label={label} title={label} onClick={() => setPreference(p)}>
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
};
