import {
  buildSchema,
  type GraphQLSchema,
  introspectionFromSchema,
} from 'graphql';
import { HttpResponse, http } from 'msw';
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
import RemoteSchemaPreview from './RemoteSchemaPreview';

const metadataUrl = 'https://local.hasura.local.nhost.run/v1/metadata';

const schemasByName: Record<string, GraphQLSchema> = {
  'my-remote': buildSchema(`
  type Query {
    posts: [Post!]!
    post(id: ID!): Post
  }

  type Post {
    id: ID!
    title: String!
  }
`),
  'other-remote': buildSchema(`
    type Query {
      postCount: Int
      latestPost: String
    }
  `),
};

const introspectedNames: string[] = [];

const metadataHandler = http.post(metadataUrl, async ({ request }) => {
  const body = (await request.json()) as {
    type: string;
    args: { name: string };
  };

  if (body.type !== 'introspect_remote_schema') {
    return HttpResponse.json(
      { error: `Unhandled metadata type: ${body.type}` },
      { status: 500 },
    );
  }

  introspectedNames.push(body.args.name);

  return HttpResponse.json({
    data: introspectionFromSchema(schemasByName[body.args.name]),
  });
});

const server = setupServer(tokenQuery, getProjectQuery, metadataHandler);

beforeAll(() => {
  mockScrollIntoViewAndPointerCapture();
  server.listen();
});

afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  introspectedNames.length = 0;
});

afterAll(() => server.close());

describe('RemoteSchemaPreview', () => {
  it('shows the introspected remote schema as a tree', async () => {
    const user = new TestUserEvent();

    render(<RemoteSchemaPreview name="my-remote" />);

    const tree = await screen.findByRole('tree');
    await user.click(within(tree).getByText('Query'));

    expect(
      await within(tree).findByText('posts: [Post!]!'),
    ).toBeInTheDocument();
    expect(introspectedNames).toEqual(['my-remote']);
  });

  it('finds matches and steps through them', async () => {
    const user = new TestUserEvent();

    render(<RemoteSchemaPreview name="my-remote" />);
    await screen.findByRole('tree');

    const searchBox = screen.getByRole('searchbox', { name: 'Search schema' });

    await user.type(searchBox, 'post');
    await user.click(screen.getByRole('button', { name: 'Find' }));

    const status = screen.getByRole('status');
    const [, count] = status.textContent?.match(/^1 of (\d+) matches$/) ?? [];

    expect(Number(count)).toBeGreaterThan(1);

    await user.type(searchBox, '{Enter}');

    expect(status).toHaveTextContent(`2 of ${count} matches`);
  });

  it('forgets the last result when it shows another remote schema', async () => {
    const user = new TestUserEvent();

    const { rerender } = render(<RemoteSchemaPreview name="my-remote" />);
    await screen.findByRole('tree');

    await user.type(
      screen.getByRole('searchbox', { name: 'Search schema' }),
      'post',
    );
    await user.click(screen.getByRole('button', { name: 'Find' }));

    expect(screen.getByRole('status')).not.toHaveTextContent('');

    rerender(<RemoteSchemaPreview name="other-remote" />);

    await waitFor(() => expect(introspectedNames).toContain('other-remote'));
    await screen.findByRole('tree');

    expect(screen.getByRole('status')).toHaveTextContent('');

    await user.type(
      screen.getByRole('searchbox', { name: 'Search schema' }),
      '{Enter}',
    );

    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 matches');
  });

  it('shows the introspection error', async () => {
    server.use(
      http.post(metadataUrl, () =>
        HttpResponse.json(
          { error: 'remote schema my-remote does not exist' },
          { status: 400 },
        ),
      ),
    );

    render(<RemoteSchemaPreview name="my-remote" />);

    expect(
      await screen.findByText(/remote schema my-remote does not exist/),
    ).toBeInTheDocument();
  });
});
