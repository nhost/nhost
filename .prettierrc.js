module.exports = {
  $schema: 'http://json.schemastore.org/prettierrc',
  arrowParens: 'always',
  bracketSameLine: false,
  bracketSpacing: true,
  endOfLine: 'lf',
  printWidth: 100,
  proseWrap: 'preserve',
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'none',
  useTabs: false,
  // TODO: add import sort configuration to match ESLint rules
  // plugins: ['./node_modules/@trivago/prettier-plugin-sort-imports'],
  // importOrderSeparation: true,
  // importOrderSortSpecifiers: true
  plugins: [],
  overrides: [
    {
      files: ['*.json', '*.yaml'],
      options: {
        useTabs: false
      }
    }
  ]
}
