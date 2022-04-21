module.exports = {
  ...require('../../prettier.config'),
  importOrder: ['^[./]'],
  plugins: ['./node_modules/@trivago/prettier-plugin-sort-imports']
}
