import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import {
  saveMetadataErrorHandler,
  saveMetadataHandler,
} from '@/tests/msw/mocks/rest/saveMetadata';
import type { MetadataOperation } from '@/utils/hasura-api/generated/schemas';
import { writeMetadata } from './metadataFetch';

const appUrl = 'https://local.hasura.local.nhost.run';
const operation = {
  type: 'delete_cron_trigger',
  args: { name: 'daily' },
} satisfies MetadataOperation;
const options = { appUrl, adminSecret: 'test-secret' };
const requests: Request[] = [];
const server = setupServer(
  http.post(`${appUrl}/v1/metadata`, () =>
    HttpResponse.json({ message: 'success' }),
  ),
  saveMetadataHandler,
);

beforeAll(() => {
  server.events.on('request:start', ({ request }) => {
    requests.push(request.clone());
  });
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
  requests.length = 0;
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
  vi.stubEnv(
    'NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL',
    `${appUrl}/apis/migrate`,
  );
});
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

it('sends only the write on the platform', async () => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');

  const response = await writeMetadata(operation, options);

  expect(response.status).toBe(200);
  expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual(
    [`POST ${appUrl}/v1/metadata`],
  );
  expect(await requests[0].json()).toEqual(operation);
});

it('saves a successful local write with the admin secret', async () => {
  const response = await writeMetadata(operation, options);

  expect(response.status).toBe(200);
  expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual(
    [`POST ${appUrl}/v1/metadata`, `GET ${appUrl}/apis/metadata?export=true`],
  );
  expect(requests[1].headers.get('x-hasura-admin-secret')).toBe('test-secret');
});

it('does not save a failed local write', async () => {
  server.use(
    http.post(`${appUrl}/v1/metadata`, () =>
      HttpResponse.json(
        {
          code: 'not-exists',
          error: 'cron trigger with name daily does not exist',
        },
        { status: 400 },
      ),
    ),
  );

  const response = await writeMetadata(operation, options);

  expect(response.status).toBe(400);
  expect(requests.map((request) => request.method)).toEqual(['POST']);
});

it('rejects the write with the not-saved message when saving fails', async () => {
  server.use(saveMetadataErrorHandler);

  await expect(writeMetadata(operation, options)).rejects.toThrow(
    /could not be saved to nhost\/metadata\. .* permission denied$/,
  );
  expect(requests.map((request) => request.method)).toEqual(['POST', 'GET']);
});
