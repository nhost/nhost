import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, waitFor } from '@/tests/testUtils';
import { graphql } from 'msw';
import { setupServer } from 'msw/node';
import { beforeAll, expect, test } from 'vitest';
import HasuraCorsDomainSettings from './HasuraCorsDomainSettings';

const server = setupServer(
  tokenQuery,
  graphql.query('GetHasuraSettings', (_req, res, ctx) =>
    res(
      ctx.data({
        config: {
          id: 'HasuraSettings',
          __typename: 'HasuraSettings',
          hasura: {
            version: 'v2.25.1-ce',
            settings: {
              corsDomain: ['*'],
              enableAllowList: false,
              enableRemoteSchemaPermissions: false,
              enableConsole: false,
              devMode: false,
              enabledAPIs: [],
            },
            logs: [],
            events: [],
          },
        },
      }),
    ),
  ),
);

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

test('should not enable switch by default when CORS domain is set to *', async () => {
  render(<HasuraCorsDomainSettings />);

  expect(await screen.findByText(/configure cors/i)).toBeInTheDocument();

  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('should enable switch by default when CORS domain is set to one or more domains', async () => {
  server.use(
    graphql.query('GetHasuraSettings', (_req, res, ctx) =>
      res(
        ctx.data({
          config: {
            id: 'HasuraSettings',
            __typename: 'HasuraSettings',
            hasura: {
              version: 'v2.25.1-ce',
              settings: {
                corsDomain: ['https://example.com', 'https://*.example.com'],
                enableAllowList: false,
                enableRemoteSchemaPermissions: false,
                enableConsole: false,
                devMode: false,
                enabledAPIs: [],
              },
              logs: [],
              events: [],
            },
          },
        }),
      ),
    ),
  );

  render(<HasuraCorsDomainSettings />);

  expect(await screen.findByText(/configure cors/i)).toBeInTheDocument();

  await waitFor(() => expect(screen.getByRole('checkbox')).toBeChecked());

  expect(screen.getByRole('textbox')).toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue(
    'https://example.com, https://*.example.com',
  );
});
