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
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
    >
      <Icon size={16} />
    </button>
  );
};
