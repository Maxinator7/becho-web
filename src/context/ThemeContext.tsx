import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

/** localStorage key; index.html reads the same key before React mounts to avoid a theme flash. */
export const THEME_STORAGE_KEY = 'becho.theme';

const PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

const readStoredPreference = (): ThemePreference => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return PREFERENCES.includes(value as ThemePreference) ? (value as ThemePreference) : 'system';
  } catch {
    return 'system';
  }
};

const applyPreference = (preference: ThemePreference) => {
  const root = document.documentElement;
  if (preference === 'system') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }
};

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Advances system → light → dark → system. */
  cyclePreference: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);

  useEffect(() => {
    applyPreference(preference);
    try {
      if (preference === 'system') {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, preference);
      }
    } catch {
      // Storage unavailable (private mode, blocked site data): the choice just won't persist.
    }
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => setPreferenceState(next), []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((current) => PREFERENCES[(PREFERENCES.indexOf(current) + 1) % PREFERENCES.length]);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, setPreference, cyclePreference }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
