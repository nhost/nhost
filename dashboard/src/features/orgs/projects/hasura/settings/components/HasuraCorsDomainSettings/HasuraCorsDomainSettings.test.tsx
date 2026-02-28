import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { beforeAll, expect, test, vi } from 'vitest';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen, waitFor } from '@/tests/testUtils';
import HasuraCorsDomainSettings from './HasuraCorsDomainSettings';

const server = setupServer(
  tokenQuery,
  graphql.query('GetHasuraSettings', () =>
    HttpResponse.json({
      data: {
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
              inferFunctionPermissions: false,
            },
            logs: [],
            events: [],
            resources: [],
          },
        },
      },
    }),
  ),
);

describe('HasuraCorsDomainSettings', () => {
  vi.stubEnv(
    'NEXT_PUBLIC_NHOST_CONFIGSERVER_URL',
    'https://my-config-server.com',
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
      graphql.query('GetHasuraSettings', () =>
        HttpResponse.json({
          data: {
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
                  inferFunctionPermissions: false,
                },
                logs: [],
                events: [],
                resources: [],
              },
            },
          },
        }),
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
});
