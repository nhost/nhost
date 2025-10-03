import { render, screen, TestUserEvent } from '@/tests/testUtils';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { buildSchema } from 'graphql';
import React from 'react';
import { RemoteSchemaTree, type RemoteSchemaTreeRef } from './RemoteSchemaTree';
import { buildComplexTreeData } from './utils';

const sdl = `
  type User {
    id: ID!
    name: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    author: User!
  }

  type Query {
    hello: String
    user(id: ID!): User
    posts: [Post!]!
  }

  type Mutation {
    updateName(id: ID!, name: String!): User
  }

  type Subscription {
    postAdded: Post
    postById(id: ID!): Post
  }
`;

const schema = buildSchema(sdl);

describe('RemoteSchemaTree', () => {
  it('applies dark theme classes/styles on wrapper', () => {
    const darkTheme = createTheme({ palette: { mode: 'dark' } });
    const { container } = render(
      <ThemeProvider theme={darkTheme}>
        <RemoteSchemaTree schema={schema} />
      </ThemeProvider>,
    );

    const wrapper = container.querySelector('.rct-dark') as HTMLElement | null;
    expect(wrapper).toBeTruthy();
    expect(wrapper!).toHaveClass('rct-dark');
    expect(wrapper).toHaveStyle({
      backgroundColor: '#171d26',
      color: '#e3e3e3',
    });
  });

  it('builds tree data including all SDL types and fields', () => {
    const treeData = buildComplexTreeData({
      schema,
    });

    expect(treeData).toHaveProperty('root');
    expect(treeData.root.children).toEqual([
      '__query',
      '__mutation',
      '__subscription',
    ]);

    expect(treeData).toHaveProperty('__query');
    expect(treeData).toHaveProperty('__query.field.hello');
    expect(treeData).toHaveProperty('__query.field.user');
    expect(treeData).toHaveProperty('__query.field.posts');

    expect(treeData).toHaveProperty('__query.field.user.arg.id');
    expect(treeData).toHaveProperty('__query.field.user.field.id');
    expect(treeData).toHaveProperty('__query.field.user.field.name');
    expect(treeData).toHaveProperty('__query.field.user.field.posts');

    expect(treeData).toHaveProperty('__query.field.posts.field.id');
    expect(treeData).toHaveProperty('__query.field.posts.field.title');
    expect(treeData).toHaveProperty('__query.field.posts.field.author');

    expect(treeData).toHaveProperty('__mutation');
    expect(treeData).toHaveProperty('__mutation.field.updateName');
    expect(treeData).toHaveProperty('__mutation.field.updateName.arg.id');
    expect(treeData).toHaveProperty('__mutation.field.updateName.arg.name');

    expect(treeData).toHaveProperty('__subscription');
    expect(treeData).toHaveProperty('__subscription.field.postAdded');
    expect(treeData).toHaveProperty('__subscription.field.postById');
    expect(treeData).toHaveProperty('__subscription.field.postById.arg.id');
  });

  it('renders DOM nodes for all SDL types after expanding the tree', async () => {
    render(<RemoteSchemaTree schema={schema} />);

    const user = new TestUserEvent();

    const queryNode = await screen.findByRole('button', { name: 'Query' });
    await user.click(queryNode);
    await user.keyboard('{ArrowRight}');

    expect(
      await screen.findByRole('button', { name: 'hello: String' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'user: User' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'posts: [Post!]!' }),
    ).toBeInTheDocument();

    const userField = await screen.findByRole('button', { name: 'user: User' });
    await user.click(userField);
    await user.keyboard('{ArrowRight}');

    expect(
      document.querySelector('[data-rct-item-id="__query.field.user.arg.id"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-rct-item-id="__query.field.user.field.id"]',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-rct-item-id="__query.field.user.field.name"]',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-rct-item-id="__query.field.user.field.posts"]',
      ),
    ).toBeInTheDocument();

    const postsField = document.querySelector(
      '[data-rct-item-id="__query.field.posts"]',
    ) as Element | null;
    expect(postsField).toBeInTheDocument();
    await user.click(postsField!);
    await user.keyboard('{ArrowRight}');

    expect(
      document.querySelector(
        '[data-rct-item-id="__query.field.posts.field.id"]',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-rct-item-id="__query.field.posts.field.title"]',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-rct-item-id="__query.field.posts.field.author"]',
      ),
    ).toBeInTheDocument();

    const mutationNode = await screen.findByRole('button', {
      name: 'Mutation',
    });
    await user.click(mutationNode);
    await user.keyboard('{ArrowRight}');

    const updateNameField = await screen.findByRole('button', {
      name: 'updateName: User',
    });
    expect(updateNameField).toBeInTheDocument();

    await user.click(updateNameField);
    await user.keyboard('{ArrowRight}');

    expect(
      document.querySelector(
        '[data-rct-item-id="__mutation.field.updateName.arg.id"]',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-rct-item-id="__mutation.field.updateName.arg.name"]',
      ),
    ).toBeInTheDocument();

    const subscriptionNode = await screen.findByRole('button', {
      name: 'Subscription',
    });
    await user.click(subscriptionNode);
    await user.keyboard('{ArrowRight}');

    expect(
      document.querySelector(
        '[data-rct-item-id="__subscription.field.postAdded"]',
      ),
    ).toBeInTheDocument();
    const postByIdField = document.querySelector(
      '[data-rct-item-id="__subscription.field.postById"]',
    ) as Element | null;
    expect(postByIdField).toBeInTheDocument();
    await user.click(postByIdField!);
    await user.keyboard('{ArrowRight}');
    expect(
      document.querySelector(
        '[data-rct-item-id="__subscription.field.postById.arg.id"]',
      ),
    ).toBeInTheDocument();
  });

  it('findAllItemPaths returns paths to matching items', () => {
    const ref = React.createRef<RemoteSchemaTreeRef>();
    render(<RemoteSchemaTree ref={ref} schema={schema} />);

    expect(ref.current).toBeTruthy();

    const helloPaths = ref.current!.findAllItemPaths('hello');
    expect(helloPaths[0]?.[helloPaths[0].length - 1]).toEqual(
      '__query.field.hello',
    );

    const postByIdPaths = ref.current!.findAllItemPaths('postById');
    expect(postByIdPaths[0]?.[postByIdPaths[0].length - 1]).toEqual(
      '__subscription.field.postById',
    );
  });

  it('findAllItemPaths is case-insensitive and returns full path including parents', () => {
    const ref = React.createRef<RemoteSchemaTreeRef>();
    render(<RemoteSchemaTree ref={ref} schema={schema} />);

    const helloPaths = ref.current!.findAllItemPaths('HELLO');
    expect(helloPaths[0]).toEqual(['root', '__query', '__query.field.hello']);
  });

  it('findAllItemPaths can match a parent item (e.g., Mutation)', () => {
    const ref = React.createRef<RemoteSchemaTreeRef>();
    render(<RemoteSchemaTree ref={ref} schema={schema} />);

    const mutationPaths = ref.current!.findAllItemPaths('Mutation');
    expect(mutationPaths[0]).toEqual(['root', '__mutation']);
  });

  it('findAllItemPaths returns empty array when no item matches', () => {
    const ref = React.createRef<RemoteSchemaTreeRef>();
    render(<RemoteSchemaTree ref={ref} schema={schema} />);

    const noMatches = ref.current!.findAllItemPaths('THIS_DOES_NOT_EXIST');
    expect(noMatches).toEqual([]);
  });

  it('renders correctly when schema uses custom root type names', async () => {
    const sdlCustom = `
      type RootQuery { ping: String }
      type RootMutation { noop: Boolean }
      type RootSubscription { heartbeat: String }
      schema { query: RootQuery, mutation: RootMutation, subscription: RootSubscription }
    `;
    const customSchema = buildSchema(sdlCustom);

    render(<RemoteSchemaTree schema={customSchema} />);

    expect(
      await screen.findByRole('button', { name: 'Query' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Mutation' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Subscription' }),
    ).toBeInTheDocument();
  });
});
