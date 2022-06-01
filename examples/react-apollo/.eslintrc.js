module.exports = {
  extends: '../../config/.eslintrc.js',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'import/extensions': 'off'
  }
}
