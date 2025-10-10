/**
 * @file theme.js
 * @description Defines the default light and dark themes for the SDK.
 */

export const defaultThemes = {
  light: {
    '--sp-bg-primary': '#ffffff',
    '--sp-bg-secondary': '#f7f7f7',
    '--sp-bg-tertiary': '#e0e0e0',
    '--sp-text-primary': '#1a1a1a',
    '--sp-text-secondary': '#555555',
    '--sp-accent-primary': '#f7941d', // Example: StablePay orange
    '--sp-accent-secondary': '#bc5f26',
    '--sp-border-primary': '#dddddd',
    '--sp-error': '#d9534f',
    '--sp-success': '#5cb85c',
  },
  dark: {
    '--sp-bg-primary': '#1a1a1a',
    '--sp-bg-secondary': '#2a2a2a',
    '--sp-bg-tertiary': '#3a3a3a',
    '--sp-text-primary': '#ffffff',
    '--sp-text-secondary': '#aaaaaa',
    '--sp-accent-primary': '#f7941d',
    '--sp-accent-secondary': '#bc5f26',
    '--sp-border-primary': '#444444',
    '--sp-error': '#d9534f',
    '--sp-success': '#5cb85c',
  },
};