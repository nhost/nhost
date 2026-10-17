import type { DocumentContext } from 'next/document';
import Document, { Head, Html, Main, NextScript } from 'next/document';
import {
  NO_TRANSITION_CSS,
  NO_TRANSITION_STYLE_ID,
} from '@/providers/Theme/utils';
import { THEME_STORAGE_KEY } from '@/utils/constants/common';

// Runs before the body is painted so the first frame already uses the right
// theme tokens. Mirrors readStoredThemePreference and resolveTheme.
// Transitions stay disabled until ThemeDocumentClass applies the preference,
// so styles loading late (e.g. in development) don't animate the colors in.
const setThemeClassScript = `(function () {
  try {
    var style = document.createElement('style');
    style.id = '${NO_TRANSITION_STYLE_ID}';
    style.textContent = '${NO_TRANSITION_CSS}';
    document.head.appendChild(style);
    var preference = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme =
      preference === 'light' || preference === 'dark'
        ? preference
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  } catch (error) {}
})();`;

export default class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    const meta = {
      title: 'Dashboard - Nhost',
      description: 'Nhost Dashboard',
      image: '/assets/splash.png',
    };

    return (
      <Html lang="en">
        <Head>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: must run before first paint */}
          <script dangerouslySetInnerHTML={{ __html: setThemeClassScript }} />
          <meta name="robots" content="follow, index" />
          <meta name="description" content={meta.description} />
          <meta property="og:site_name" content={meta.title} />
          <meta property="og:description" content={meta.description} />
          <meta property="og:title" content={meta.title} />
          <meta property="og:image" content={meta.image} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@nhost" />
          <meta name="twitter:title" content={meta.title} />
          <meta name="twitter:description" content={meta.description} />
          <meta name="twitter:image" content={meta.image} />
          <link rel="shortcut icon" href="/assets/favicon.png" />
        </Head>
        <body>
          <Main />
          <div id="modal" />
          <NextScript />
        </body>
      </Html>
    );
  }
}
