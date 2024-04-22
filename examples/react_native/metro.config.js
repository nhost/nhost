const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const projectRoot = path.resolve(__dirname);

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    nodeModulesPaths: ['node_modules', '../../node_modules'],
  },
  watchFolders: [projectRoot, path.resolve(__dirname, '../..', 'node_modules')],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
