const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    'storybook-addon-next-router',
    {
      /**
       * Fix Storybook issue with PostCSS@8
       * @see https://github.com/storybookjs/storybook/issues/12668#issuecomment-773958085
       */
      name: '@storybook/addon-postcss',
      options: {
        postcssLoaderOptions: {
          implementation: require('postcss'),
        },
      },
    },
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
  env: (config) => ({
    ...config,
    NEXT_PUBLIC_ENV: 'dev',
    NEXT_PUBLIC_NHOST_PLATFORM: 'false',
  }),
};
