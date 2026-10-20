import { buildSchema, introspectionFromSchema } from 'graphql';
import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import GraphQLSchemaViewer from './GraphQLSchemaViewer';

async function findInTree(text: string) {
  return within(await screen.findByRole('tree')).findByText(text);
}

const graphqlLink = graphql.link('https://local.graphql.local.nhost.run/v1');

const schemasByRole: Record<string, string> = {
  admin: 'type Query { users: [users!]! } type users { id: ID! }',
  user: 'type Query { me: String }',
};

const requestedRoles: (string | null)[] = [];

const rolesQuery = graphqlLink.query('getRemoteAppRoles', () =>
  HttpResponse.json({
    data: { authRoles: [{ role: 'user' }, { role: 'editor' }] },
  }),
);

const introspectionQuery = graphqlLink.query(
  'IntrospectionQuery',
  ({ request }) => {
    const role = request.headers.get('x-hasura-role');

    requestedRoles.push(role);

    return HttpResponse.json({
      data: introspectionFromSchema(buildSchema(schemasByRole[role ?? ''])),
    });
  },
);

const server = setupServer(
  tokenQuery,
  getProjectQuery,
  rolesQuery,
  introspectionQuery,
);

beforeAll(() => {
  mockScrollIntoViewAndPointerCapture();
  server.listen();
});

afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  requestedRoles.length = 0;
});

afterAll(() => server.close());

describe('GraphQLSchemaViewer', () => {
  it('shows the admin schema by default', async () => {
    render(<GraphQLSchemaViewer />);

    expect(await findInTree('Query')).toBeInTheDocument();
    expect(requestedRoles).toEqual(['admin']);
  });

  it('offers the Playground roles and loads the schema of the chosen role', async () => {
    const user = new TestUserEvent();

    render(<GraphQLSchemaViewer />);
    await findInTree('Query');

    await user.click(screen.getByRole('combobox', { name: 'Role' }));

    await waitFor(() =>
      expect(
        screen.getAllByRole('option').map((option) => option.textContent),
      ).toEqual(['admin', 'public', 'anonymous', 'user', 'editor']),
    );

    await user.click(screen.getByRole('option', { name: 'user' }));
    await user.click(await findInTree('Query'));

    expect(await screen.findByText('me: String')).toBeInTheDocument();
    expect(requestedRoles).toEqual(['admin', 'user']);
  });

  it('shows the server error and retries', async () => {
    const user = new TestUserEvent();

    server.use(
      graphqlLink.query('IntrospectionQuery', () =>
        HttpResponse.json({
          errors: [{ message: 'introspection is disabled' }],
        }),
      ),
    );

    render(<GraphQLSchemaViewer />);

    expect(
      await screen.findByText('introspection is disabled'),
    ).toBeInTheDocument();

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await findInTree('Query')).toBeInTheDocument();
  });
});
