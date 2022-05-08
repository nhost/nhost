// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Nhost Docs',
  tagline:
    'Nhost is an open-source, real-time, server-less backend platform for building reliable apps that scale with your business.',
  url: 'https://docs.nhost.io',
  trailingSlash: false,
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.png',
  organizationName: 'nhost', // Usually your GitHub org/user name.
  projectName: 'docs', // Usually your repo name.

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
        },
        docs: {
          path: 'docs',
          routeBasePath: '/',
          breadcrumbs: false,
          sidebarPath: require.resolve('./sidebars.js'),
          remarkPlugins: [require('mdx-mermaid')],
          // Please change this to your repo.
          editUrl: 'https://github.com/nhost/nhost/edit/main/docs/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      metadata: [
        {
          name: 'og:image',
          content: 'https://docs.nhost.io/img/splash.png',
        },
      ],
      navbar: {
        hideOnScroll: true,
        logo: {
          alt: 'Nhost',
          src: 'img/logo.svg',
          srcDark: 'img/logo-dark.svg',
          href: 'https://nhost.io',
        },
        items: [
          {
            type: 'doc',
            docId: 'get-started/index',
            position: 'left',
            label: 'Get Started',
          },
          {
            type: 'doc',
            docId: 'platform/index',
            position: 'left',
            label: 'Platform',
          },
          {
            type: 'doc',
            docId: 'reference/index',
            position: 'left',
            label: 'Reference',
          },
          {
            href: 'https://github.com/nhost/nhost',
            className: 'header-github-link',
            position: 'right',
            'aria-label': 'Github repository',
          },
          {
            href: 'https://app.nhost.io',
            className: 'header-get-started-link',
            position: 'right',
            label: 'Get started',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Product',
            items: [
              {
                label: 'Product',
                href: 'https://nhost.io/#product',
              },
              {
                label: 'Features',
                href: 'https://nhost.io/#features',
              },
              {
                label: 'Pricing',
                href: 'https://nhost.io/pricing',
              },
            ],
          },
          {
            title: 'Docs',
            items: [
              {
                label: 'Get Started',
                to: '/get-started',
              },
              {
                label: 'Platform',
                to: '/platform',
              },
              {
                label: 'Reference',
                to: '/reference',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/nhost/nhost',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/nhostio',
              },
              {
                label: 'LinkedIn',
                href: 'https://www.linkedin.com/company/nhost/',
              },
              {
                label: 'Discord',
                href: 'https://discord.com/invite/9V7Qb2U',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                href: 'https://nhost.io/blog',
              },
              {
                label: 'Privacy Policy',
                href: 'https://nhost.io/privacy-policy',
              },
              {
                label: 'Terms of Service',
                href: 'https://nhost.io/terms-of-service',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} <a href="https://nhost.io" target="_blank" rel="noopener noreferrer">Nhost</a>. All rights reserved.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        defaultLanguage: 'javascript',
      },
      algolia: {
        appId: '3A3MJQTKHU',
        apiKey: 'a76361eaed8ebcd4cf5d9ae2f0c9e746',
        indexName: 'nhost',
        contextualSearch: false,
      },
    }),
};

module.exports = config;
