const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: '@storybook/react',
  core: {
    builder: '@storybook/builder-webpack5',
  },
  features: {
    emotionAlias: true,
  },
  webpackFinal: async (config) => {
    return {
      ...config,
      resolve: {
        ...config?.resolve,
        plugins: [
          ...(config?.resolve?.plugins || []),
          new TsconfigPathsPlugin(),
        ],
      },
    };
  },
};
