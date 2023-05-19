import { rest } from 'msw';
import { setupServer } from 'msw/node';
import type { ManagePermissionOptions } from './managePermission';
import managePermission from './managePermission';

const defaultParameters: ManagePermissionOptions = {
  dataSource: 'default',
  schema: 'public',
  table: 'users',
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

test('should throw an error if permission object is incorrectly provided', async () => {
  await expect(
    managePermission({
      ...defaultParameters,
      action: 'select',
      role: 'user',
      mode: 'update',
      resourceVersion: 1,
    }),
  ).rejects.toThrowError(
    new Error(
      'A permission must be provided when creating or updating a permission.',
    ),
  );
});
