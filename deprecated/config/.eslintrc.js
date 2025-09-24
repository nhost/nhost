const base = require('./.eslint.base')
module.exports = {
  ...base,
  extends: [
    ...base.extends,
    'react-app',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime'
  ],
  plugins: [...base.plugins, 'react', 'react-hooks']
}
