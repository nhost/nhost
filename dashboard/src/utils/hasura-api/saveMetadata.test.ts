import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import {
  saveMetadataErrorHandler,
  saveMetadataHandler,
} from '@/tests/msw/mocks/rest/saveMetadata';
import { saveMetadata } from './saveMetadata';

const notSavedMessage =
  'The change was applied to the running project but could not be saved to nhost/metadata. The next nhost up or metadata apply will revert it. Reload before trying again, because creating the same object twice can fail.';
const requests: Request[] = [];
const server = setupServer(saveMetadataHandler);

beforeAll(() => {
  server.events.on('request:start', ({ request }) => {
    requests.push(request.clone());
  });
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
  requests.length = 0;
  vi.stubEnv(
    'NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL',
    'https://local.hasura.local.nhost.run/apis/migrate',
  );
});
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

it('asks the CLI next to the migrations API to save the metadata', async () => {
  await saveMetadata('test-secret');

  expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual(
    ['GET https://local.hasura.local.nhost.run/apis/metadata?export=true'],
  );
  expect(requests[0].headers.get('x-hasura-admin-secret')).toBe('test-secret');
});

it('keeps a path in front of the migrations API', async () => {
  vi.stubEnv(
    'NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL',
    'https://proxy.example/hasura-cli/apis/migrate',
  );
  server.use(
    http.get('https://proxy.example/hasura-cli/apis/metadata', () =>
      HttpResponse.json({ metadata: 'Success' }),
    ),
  );

  await saveMetadata();

  expect(requests.map((request) => request.url)).toEqual([
    'https://proxy.example/hasura-cli/apis/metadata?export=true',
  ]);
});

it("ends the not-saved message with the CLI's error", async () => {
  server.use(saveMetadataErrorHandler);

  await expect(saveMetadata()).rejects.toThrow(
    new Error(`${notSavedMessage} permission denied`),
  );
});

it('says the change was not saved when the CLI cannot be reached', async () => {
  server.use(
    http.get('https://local.hasura.local.nhost.run/apis/metadata', () =>
      HttpResponse.error(),
    ),
  );

  await expect(saveMetadata()).rejects.toThrow(new Error(notSavedMessage));
});
