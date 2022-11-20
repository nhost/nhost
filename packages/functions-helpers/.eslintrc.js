module.exports = {
  extends: '../../config/.eslintrc.js',
  ignorePatterns: ['functions/**/*'],
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname
  }
}
