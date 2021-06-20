module.exports = {
  title: 'Hasura Backend Plus Documentation',
  base: '/hasura-auth/',
  themeConfig: {
    logo: 'logo.png',
    nav: [
      { text: 'Getting started', link: '/guide/' },
      { text: 'Configuration', link: '/configuration/' },
      // { text: 'Recipes', link: '/recipes/' },
      { text: 'API', link: '/api/' }
    ],
    displayAllHeaders: true,
    sidebarDepth: 2,
    // sidebar: ['/guide', '/configuration', 'recipes', '/api'],
    sidebar: ['/guide', '/configuration', '/api'],
    smoothScroll: true,
    lastUpdated: 'Last Updated',
    repo: 'nhost/hasura-auth',
    editLinks: true
  },
  plugins: ['@vuepress/plugin-back-to-top'],
  markdown: {
    lineNumbers: true,
    extendMarkdown: (md) => {
      md.use(require('markdown-it-multimd-table'), {
        multiline: true,
        rowspan: true,
        headerless: false
      })
    }
  }
}
