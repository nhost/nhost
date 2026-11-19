import { Platform } from 'react-native';

// One palette, dark, no theme to switch to: the React starter's tokens, from
// its oklch values to sRGB.
export const colors = {
  background: '#1d1d1d',
  foreground: '#f5f5f5',
  card: '#262626',
  primary: '#e4e4e4',
  primaryForeground: '#1d1d1d',
  secondary: '#333333',
  muted: '#333333',
  mutedForeground: '#a4a4a4',
  accent: '#333333',
  destructive: '#ff6467',
  destructiveBackground: 'rgba(255, 100, 103, 0.1)',
  destructiveBorder: 'rgba(255, 100, 103, 0.5)',
  success: '#3ecf8e',
  border: 'rgba(255, 255, 255, 0.12)',
  input: 'rgba(255, 255, 255, 0.18)',
  ring: '#808080',
} as const;

export const radius = {
  md: 8,
  lg: 10,
  xl: 14,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  '2xl': 24,
  '3xl': 30,
} as const;

export const monospace = Platform.select({
  ios: 'Menlo',
  default: 'monospace',
});
