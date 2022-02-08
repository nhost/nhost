const path = require('path')
const { getLoader, loaderByName } = require('@craco/craco')

const packageDirs = ['nhost', 'react-apollo', 'react-auth', 'hasura-auth', 'hasura-storage']
const packages = packageDirs.map((dir) => path.join(__dirname, '../../packages', dir))

module.exports = {
  plugins: [
    {
      plugin: {
        overrideWebpackConfig: ({ webpackConfig }) => {
          const { isFound, match } = getLoader(webpackConfig, loaderByName('babel-loader'))
          if (isFound) {
            const include = Array.isArray(match.loader.include)
              ? match.loader.include
              : [match.loader.include]
            match.loader.include = include.concat(packages)
          }
          return webpackConfig
        }
      }
    }
  ],
  style: {
    postcss: {
      plugins: [require('tailwindcss'), require('autoprefixer')]
    }
  }
}
