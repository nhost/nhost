const path = require('path');
const {getDefaultConfig} = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(__dirname, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  modules: workspaceRoot,
};

config.server = {
  ...config.server,
  enhanceMiddleware: middleware => {
    return (req, res, next) => {
      // When an asset is imported outside the project root, it has wrong path on Android
      // So we fix the path to correct one
      if (/\/packages\/.+\.png\?.+$/.test(req.url)) {
        req.url = `/assets/../${req.url}`;
      }

      return middleware(req, res, next);
    };
  },
};

module.exports = config;
