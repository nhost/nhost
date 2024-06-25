const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('path')

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const projectRoot = __dirname

const config = {
  watchFolders: [projectRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')]
  }
}
module.exports = mergeConfig(getDefaultConfig(__dirname), config)
