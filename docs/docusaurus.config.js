// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github')
const darkCodeTheme = require('prism-react-renderer/themes/dracula')

const getBaseUrl = () => {
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://docs.nhost.io'
  } else if (process.env.VERCEL_ENV === 'preview') {
    return `https://${process.env.VERCEL_URL}`
  } else {
    return `http://localhost:3000`
  }
}

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Nhost Docs',
  tagline: 'Nhost is an open source Firebase alternative with GraphQL.',
  url: getBaseUrl(),
  trailingSlash: false,
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.png',
  organizationName: 'nhost',
  projectName: 'docs',
  markdown: {
    mermaid: true
  },
  themes: ['@docusaurus/theme-mermaid'],
  scripts: [
    { src: 'https://plausible.io/js/script.js', defer: true, 'data-domain': 'docs.nhost.io' }
  ],
  plugins: [require.resolve('docusaurus-plugin-image-zoom')],
  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5
        },
        docs: {
          path: 'docs',
          routeBasePath: '/',
          breadcrumbs: false,
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/nhost/nhost/edit/main/docs/'
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css')
        }
      })
    ]
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/splash.png',
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true
      },
      metadata: [{ name: 'robots', content: 'max-image-preview:large' }],
      navbar: {
        hideOnScroll: true,
        logo: {
          alt: 'Nhost',
          src: 'img/logo.svg',
          srcDark: 'img/logo-dark.svg',
          href: 'https://nhost.io'
        },
        items: [
          {
            type: 'doc',
            docId: 'index',
            position: 'left',
            label: 'Documentation'
          },
          {
            type: 'doc',
            docId: 'reference/index',
            position: 'left',
            label: 'Reference'
          },
          {
            href: 'https://github.com/nhost/nhost',
            className: 'header-github-link',
            position: 'right',
            'aria-label': 'Github repository'
          },
          {
            href: 'https://app.nhost.io',
            className: 'header-get-started-link',
            position: 'right',
            label: 'Dashboard'
          }
        ]
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Product',
            items: [
              {
                label: 'Product',
                href: 'https://nhost.io/#product'
              },
              {
                label: 'Features',
                href: 'https://nhost.io/#features'
              },
              {
                label: 'Pricing',
                href: 'https://nhost.io/pricing'
              }
            ]
          },
          {
            title: 'Docs',
            items: [
              {
                label: 'Documentation',
                to: '/'
              },
              {
                label: 'Reference',
                to: '/reference'
              }
            ]
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/nhost/nhost'
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/nhostio'
              },
              {
                label: 'LinkedIn',
                href: 'https://www.linkedin.com/company/nhost/'
              },
              {
                label: 'Discord',
                href: 'https://discord.com/invite/9V7Qb2U'
              }
            ]
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                href: 'https://nhost.io/blog'
              },
              {
                label: 'Privacy Policy',
                href: 'https://nhost.io/privacy-policy'
              },
              {
                label: 'Terms of Service',
                href: 'https://nhost.io/terms-of-service'
              }
            ]
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} <a href="https://nhost.io" target="_blank" rel="noopener noreferrer">Nhost</a>. All rights reserved.`
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        defaultLanguage: 'javascript',
        additionalLanguages: ['cue', 'toml'],
        magicComments: [
          {
            className: 'code-block-error-line',
            line: 'code-block-error-line'
          },
          {
            className: 'code-block-success-line',
            line: 'code-block-success-line'
          }
        ]
      },
      algolia: {
        appId: '3A3MJQTKHU',
        apiKey: 'a76361eaed8ebcd4cf5d9ae2f0c9e746',
        indexName: 'nhost',
        contextualSearch: true
      },
      zoom: {
        selector: '.markdown :not(em) > img',
        config: {
          // options you can specify via https://github.com/francoischalifour/medium-zoom#usage
          background: {
            light: 'rgb(255, 255, 255)',
            dark: 'rgb(50, 50, 50)'
          }
        }
      }
    })
}

module.exports = config
