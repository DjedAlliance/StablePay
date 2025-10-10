import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { defaultThemes } from '../styles/theme';

const ThemeContext = createContext(null);

/**
 * Custom hook to access the theme context.
 * @returns {{
 *  themeMode: ('light'|'dark'|'auto'),
 *  setTheme: (mode: 'light'|'dark'|'auto') => void
 * }}
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Provider component for the theme context.
 * Manages the application's theme and applies it.
 * @param {{
 *  children: React.ReactNode,
 *  themeConfig?: {
 *    mode?: 'light'|'dark'|'auto',
 *    customTheme?: object
 *  }
 * }} props
 */
export const ThemeProvider = ({ children, themeConfig = {} }) => {
  const { mode: initialMode = 'auto', customTheme = {} } = themeConfig;
  const [themeMode, setThemeMode] = useState(initialMode);

  const mergedThemes = useMemo(() => {
    // Deep merge custom theme into defaults
    const merged = JSON.parse(JSON.stringify(defaultThemes)); // Deep copy
    if (customTheme.light) {
      Object.assign(merged.light, customTheme.light);
    }
    if (customTheme.dark) {
      Object.assign(merged.dark, customTheme.dark);
    }
    return merged;
  }, [customTheme]);

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (mode) => {
      const theme = mergedThemes[mode];
      Object.keys(theme).forEach(key => {
        root.style.setProperty(key, theme[key]);
      });
      root.setAttribute('data-theme', mode);
    };

    const handleSystemThemeChange = (e) => {
      const newMode = e.matches ? 'dark' : 'light';
      // Only apply if mode is still 'auto'
      if (themeMode === 'auto') {
        applyTheme(newMode);
      }
    };

    if (themeMode === 'auto') {
      const systemThemeMatcher = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(systemThemeMatcher.matches ? 'dark' : 'light');
      systemThemeMatcher.addEventListener('change', handleSystemThemeChange);
      return () => {
        systemThemeMatcher.removeEventListener('change', handleSystemThemeChange);
      };
    } else {
      applyTheme(themeMode);
    }
  }, [themeMode, mergedThemes]);

  const setTheme = (mode) => {
    if (['light', 'dark', 'auto'].includes(mode)) {
      setThemeMode(mode);
    } else {
      console.warn(`Unsupported theme mode: ${mode}`);
    }
  };

  const value = {
    themeMode,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};