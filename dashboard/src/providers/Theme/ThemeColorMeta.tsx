import useThemePreference from '@/providers/Theme/useThemePreference';

function ThemeColorMeta() {
  const { resolvedTheme, isLoaded } = useThemePreference();

  if (!isLoaded) {
    return null;
  }

  // React hoists <meta> into <head>.
  return (
    <meta
      name="theme-color"
      content={resolvedTheme === 'dark' ? '#171d26' : '#ffffff'}
    />
  );
}

ThemeColorMeta.displayName = 'NhostThemeColorMeta';

export default ThemeColorMeta;
