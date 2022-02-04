const config = {
  module: '@beemo/dev',
  drivers: {
    eslint: {
      args: ['--cache-location', './node_modules/.cache/eslint', '--cache']
    }
  },
  settings: {
    useBuiltIns: false,
    node: true
  }
}

export default config
