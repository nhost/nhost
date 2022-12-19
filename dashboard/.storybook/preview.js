import '@fontsource/inter';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { NhostApolloProvider } from '@nhost/react-apollo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Buffer } from 'buffer';
import { initialize, mswDecorator } from 'msw-storybook-addon';
import { RouterContext } from 'next/dist/shared/lib/router-context';
import '../src/styles/globals.css';
import defaultTheme from '../src/theme/default';

global.Buffer = Buffer;

initialize({ onUnhandledRequest: 'bypass' });

const queryClient = new QueryClient();

export const parameters = {
  nextRouter: {
    Provider: RouterContext.Provider,
    isReady: true,
  },
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};

export const decorators = [
  (Story) => (
    <ThemeProvider theme={defaultTheme}>
      <CssBaseline />
      <Story />
    </ThemeProvider>
  ),
  (Story) => (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  ),
  (Story) => (
    <NhostApolloProvider
      fetchPolicy="cache-first"
      graphqlUrl="http://localhost:1337/v1/graphql"
    >
      <Story />
    </NhostApolloProvider>
  ),
  mswDecorator,
];
