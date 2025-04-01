module.exports = {
  $schema: 'http://json.schemastore.org/prettierrc',
  arrowParens: 'always',
  bracketSameLine: false,
  bracketSpacing: true,
  endOfLine: 'lf',
  printWidth: 80,
  proseWrap: 'preserve',
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
  plugins: ['prettier-plugin-organize-imports', 'prettier-plugin-tailwindcss'],
  overrides: [
    {
      files: ['*.json', '*.yaml'],
      options: {
        useTabs: false
      }
    }
  ]
}
