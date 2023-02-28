const base = require('../../config/.eslintrc.js')
module.exports = {
  ...base,
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname
  },
  ignorePatterns: [...base.ignorePatterns, 'functions/**/*.ts']
}
