import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';

export default {
  plugins: [pluginLineNumbers()],
  defaultProps: {
    showLineNumbers: false,
  },
};
