import Head from 'next/head';
import useThemePreference from '@/providers/Theme/useThemePreference';

function ThemeColorMeta() {
  const { resolvedTheme, isLoaded } = useThemePreference();

  if (!isLoaded) {
    return null;
  }

  return (
    <Head>
      <meta
        name="theme-color"
        content={resolvedTheme === 'dark' ? '#171d26' : '#ffffff'}
      />
    </Head>
  );
}

ThemeColorMeta.displayName = 'NhostThemeColorMeta';

export default ThemeColorMeta;
