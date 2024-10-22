import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';

export const ShadcnThemeProvider = (
  props: ThemeProviderProps,
): React.JSX.Element => {
  return NextThemesProvider(props) as React.JSX.Element;
};
