import React from 'react';
import { Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../context/ThemeContext';

export const BrandMark: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <span className="a-brand__mark" aria-hidden>
    <ShieldCheck size={size} />
  </span>
);

const THEME_OPTIONS: Record<ThemePreference, { label: string; next: string; Icon: typeof Monitor }> = {
  system: { label: 'System theme', next: 'light', Icon: Monitor },
  light: { label: 'Light theme', next: 'dark', Icon: Sun },
  dark: { label: 'Dark theme', next: 'system', Icon: Moon },
};

/** Cycles system → light → dark (shared preference with the marketplace). */
export const AdminThemeToggle: React.FC = () => {
  const { preference, cyclePreference } = useTheme();
  const { label, next, Icon } = THEME_OPTIONS[preference];
  const title = `${label} (click for ${next})`;
  return (
    <button type="button" className="a-iconbtn" onClick={cyclePreference} aria-label={title} title={title}>
      <Icon size={18} />
    </button>
  );
};

