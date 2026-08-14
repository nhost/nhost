import { useEffect } from 'react';
import useThemePreference from '@/providers/Theme/useThemePreference';

function ThemeDocumentClass() {
  const { resolvedTheme } = useThemePreference();

  useEffect(() => {
    const rootElement = document.documentElement;
    rootElement.classList.remove('light', 'dark');
    rootElement.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  return null;
}

ThemeDocumentClass.displayName = 'NhostThemeDocumentClass';

export default ThemeDocumentClass;
