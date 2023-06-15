import '@fontsource/inter';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { NhostClient, NhostProvider } from '@nhost/nextjs';
import { NhostApolloProvider } from '@nhost/react-apollo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Buffer } from 'buffer';
import { initialize, mswDecorator } from 'msw-storybook-addon';
import { RouterContext } from 'next/dist/shared/lib/router-context';
import { createTheme } from '../src/components/ui/v2/createTheme';
import '../src/styles/globals.css';

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
  (Story, context) => {
    const isDarkMode = !context.globals?.backgrounds?.value
      ?.toLowerCase()
      ?.startsWith('#f');

    return (
      <ThemeProvider theme={createTheme(isDarkMode ? 'dark' : 'light')}>
        <CssBaseline />
        <Story />
      </ThemeProvider>
    );
  },
  (Story) => (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  ),
  (Story) => (
    <NhostApolloProvider
      fetchPolicy="cache-first"
      graphqlUrl="https://local.graphql.nhost.run/v1"
    >
      <Story />
    </NhostApolloProvider>
  ),
  (Story) => (
    <NhostProvider nhost={new NhostClient({ subdomain: 'local' })}>
      <Story />
    </NhostProvider>
  ),
  mswDecorator,
];
