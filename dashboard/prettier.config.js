module.exports = {
  singleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  endOfLine: 'auto',
  semi: true,
  plugins: [
    require('prettier-plugin-organize-imports'),
    require('prettier-plugin-tailwindcss'),
  ],
};
