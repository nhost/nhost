const base = require('./.eslint.base.js')
module.exports = {
  ...base,
  extends: ['react-app', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  plugins: [...base.plugins, 'react', 'react-hooks']
}
