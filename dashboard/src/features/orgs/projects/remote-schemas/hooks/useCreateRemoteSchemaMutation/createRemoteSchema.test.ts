import { rest } from 'msw';
import { setupServer } from 'msw/node';
import type { CreateRemoteSchemaOptions } from './createRemoteSchema';

const defaultParameters: CreateRemoteSchemaOptions = {
  appUrl: 'http://localhost:1337',
  adminSecret: 'x-hasura-admin-secret',
};

const server = setupServer(
  rest.post('http://localhost:1337/v1/metadata', (_req, res, ctx) =>
    res(ctx.json({})),
  ),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// test('should throw an error if remote schema is incorrectly provided', async () => {
//   await expect(
//     createRemoteSchema({
//       ...defaultParameters,
//       name: 'test',
//       comment: 'test',
//       definition: {
//         customization: {},
//         forward_client_headers: true,
//         headers: [],
//         timeout_seconds: 10,
//         url: 'https://example.com',
//       },
//     }),
//   ).rejects.toThrowError(
//     new Error(
//       'A remote schema definition must be provided when creating a remote schema.',
//     ),
//   );
// });
