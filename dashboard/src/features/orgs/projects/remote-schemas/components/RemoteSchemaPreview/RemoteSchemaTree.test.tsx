import { render, screen, TestUserEvent } from '@/tests/testUtils';
import { buildSchema } from 'graphql';
import React from 'react';
import { RemoteSchemaTree } from './RemoteSchemaTree';
import type { AllowedRootFields, RelationshipFields } from './types';
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
  it('renders a tree for a basic schema and matches snapshot', () => {
    const relationshipFields: RelationshipFields[] = [];
    const rootFields: AllowedRootFields = ['query', 'mutation', 'subscription'];
    const fields: string[] = [];
    const setRelationshipFields = (() => {}) as React.Dispatch<
      React.SetStateAction<RelationshipFields[]>
    >;

    render(
      <RemoteSchemaTree
        schema={schema}
        relationshipFields={relationshipFields}
        rootFields={rootFields}
        setRelationshipFields={setRelationshipFields}
        fields={fields}
        showOnlySelectable={false}
        checkable
      />,
    );

    const tree = screen.getByRole('tree', { name: 'Remote Schema Tree' });
    expect(tree).toMatchInlineSnapshot(`
      <div
        aria-label="Remote Schema Tree"
        data-rct-tree="schema-tree"
        role="tree"
        style="min-height: 30px; position: relative;"
      >
        <div
          id="rct-livedescription-schema-tree"
          style="clip-path: inset(50%); height: 1px; overflow: hidden; position: absolute; white-space: nowrap; width: 1px;"
        >
          <div
            aria-live="off"
          >
            
          
            <p>
              Accessibility guide for tree Remote Schema Tree.
            </p>
            
          
            <p>
              
            Navigate the tree with the arrow keys. Common tree hotkeys apply. Further keybindings are available:
          
            </p>
            
          
            <ul>
              
            
              <li>
                enter to execute primary action on focused item
              </li>
              
            
              <li>
                f2 to start renaming the focused item
              </li>
              
            
              <li>
                escape to abort renaming an item
              </li>
              
            
              <li>
                control+d to start dragging selected items
              </li>
              
          
            </ul>
            
        
          </div>
        </div>
        <ul
          class="rct-tree-items-container"
        >
          <li
            aria-expanded="false"
            aria-selected="false"
            class="rct-tree-item-li rct-tree-item-li-isFolder rct-tree-item-li-focused"
            role="treeitem"
          >
            <div
              class="rct-tree-item-title-container rct-tree-item-title-container-isFolder rct-tree-item-title-container-focused"
              data-rct-item-container="true"
              style="--depthOffset: 10px;"
            >
              <div
                aria-hidden="true"
                class="rct-tree-item-arrow-isFolder rct-tree-item-arrow"
                tabindex="-1"
              >
                <svg
                  enable-background="new 0 0 16 16"
                  version="1.1"
                  viewBox="0 0 16 16"
                  x="0px"
                  xml:space="preserve"
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  y="0px"
                >
                  <g>
                    <g>
                      <path
                        class="rct-tree-item-arrow-path"
                        clip-rule="evenodd"
                        d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"
                        fill-rule="evenodd"
                      />
                    </g>
                  </g>
                </svg>
              </div>
              <button
                class="rct-tree-item-button rct-tree-item-button-isFolder rct-tree-item-button-focused"
                data-rct-item-focus="true"
                data-rct-item-id="__query"
                data-rct-item-interactive="true"
                tabindex="0"
                type="button"
              >
                Query
              </button>
            </div>
          </li>
          <li
            aria-expanded="false"
            aria-selected="false"
            class="rct-tree-item-li rct-tree-item-li-isFolder"
            role="treeitem"
          >
            <div
              class="rct-tree-item-title-container rct-tree-item-title-container-isFolder"
              data-rct-item-container="true"
              style="--depthOffset: 10px;"
            >
              <div
                aria-hidden="true"
                class="rct-tree-item-arrow-isFolder rct-tree-item-arrow"
                tabindex="-1"
              >
                <svg
                  enable-background="new 0 0 16 16"
                  version="1.1"
                  viewBox="0 0 16 16"
                  x="0px"
                  xml:space="preserve"
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  y="0px"
                >
                  <g>
                    <g>
                      <path
                        class="rct-tree-item-arrow-path"
                        clip-rule="evenodd"
                        d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"
                        fill-rule="evenodd"
                      />
                    </g>
                  </g>
                </svg>
              </div>
              <button
                class="rct-tree-item-button rct-tree-item-button-isFolder"
                data-rct-item-focus="false"
                data-rct-item-id="__mutation"
                data-rct-item-interactive="true"
                tabindex="-1"
                type="button"
              >
                Mutation
              </button>
            </div>
          </li>
          <li
            aria-expanded="false"
            aria-selected="false"
            class="rct-tree-item-li rct-tree-item-li-isFolder"
            role="treeitem"
          >
            <div
              class="rct-tree-item-title-container rct-tree-item-title-container-isFolder"
              data-rct-item-container="true"
              style="--depthOffset: 10px;"
            >
              <div
                aria-hidden="true"
                class="rct-tree-item-arrow-isFolder rct-tree-item-arrow"
                tabindex="-1"
              >
                <svg
                  enable-background="new 0 0 16 16"
                  version="1.1"
                  viewBox="0 0 16 16"
                  x="0px"
                  xml:space="preserve"
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  y="0px"
                >
                  <g>
                    <g>
                      <path
                        class="rct-tree-item-arrow-path"
                        clip-rule="evenodd"
                        d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"
                        fill-rule="evenodd"
                      />
                    </g>
                  </g>
                </svg>
              </div>
              <button
                class="rct-tree-item-button rct-tree-item-button-isFolder"
                data-rct-item-focus="false"
                data-rct-item-id="__subscription"
                data-rct-item-interactive="true"
                tabindex="-1"
                type="button"
              >
                Subscription
              </button>
            </div>
          </li>
        </ul>
      </div>
    `);
  });

  it('builds tree data including all SDL types and fields', () => {
    const relationshipFields: RelationshipFields[] = [];
    const rootFields: AllowedRootFields = ['query', 'mutation', 'subscription'];
    const fields: string[] = [];

    const treeData = buildComplexTreeData({
      schema,
      relationshipFields,
      rootFields,
      fields,
      showOnlySelectable: false,
    });

    // Root and root categories
    expect(treeData).toHaveProperty('root');
    expect(treeData.root.children).toEqual([
      '__query',
      '__mutation',
      '__subscription',
    ]);

    // Query root fields
    expect(treeData).toHaveProperty('__query');
    expect(treeData).toHaveProperty('__query.field.hello');
    expect(treeData).toHaveProperty('__query.field.user');
    expect(treeData).toHaveProperty('__query.field.posts');

    // Query.user argument and nested User fields
    expect(treeData).toHaveProperty('__query.field.user.arg.id');
    expect(treeData).toHaveProperty('__query.field.user.field.id');
    expect(treeData).toHaveProperty('__query.field.user.field.name');
    expect(treeData).toHaveProperty('__query.field.user.field.posts');

    // Query.posts nested Post fields
    expect(treeData).toHaveProperty('__query.field.posts.field.id');
    expect(treeData).toHaveProperty('__query.field.posts.field.title');
    expect(treeData).toHaveProperty('__query.field.posts.field.author');

    // Mutation root fields and arguments
    expect(treeData).toHaveProperty('__mutation');
    expect(treeData).toHaveProperty('__mutation.field.updateName');
    expect(treeData).toHaveProperty('__mutation.field.updateName.arg.id');
    expect(treeData).toHaveProperty('__mutation.field.updateName.arg.name');

    // Subscription root fields and arguments
    expect(treeData).toHaveProperty('__subscription');
    expect(treeData).toHaveProperty('__subscription.field.postAdded');
    expect(treeData).toHaveProperty('__subscription.field.postById');
    expect(treeData).toHaveProperty('__subscription.field.postById.arg.id');
  });

  it('renders DOM nodes for all SDL types after expanding the tree', async () => {
    const relationshipFields: RelationshipFields[] = [];
    const rootFields: AllowedRootFields = ['query', 'mutation', 'subscription'];
    const fields: string[] = [];
    const setRelationshipFields = (() => {}) as React.Dispatch<
      React.SetStateAction<RelationshipFields[]>
    >;

    render(
      <RemoteSchemaTree
        schema={schema}
        relationshipFields={relationshipFields}
        rootFields={rootFields}
        setRelationshipFields={setRelationshipFields}
        fields={fields}
        showOnlySelectable={false}
        checkable
      />,
    );

    const user = new TestUserEvent();

    // Expand Query
    const queryNode = await screen.findByRole('button', { name: 'Query' });
    await user.click(queryNode);
    await user.keyboard('{ArrowRight}');

    // Assert Query children are rendered
    expect(
      await screen.findByRole('button', { name: 'hello: String' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'user: User' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'posts: [Post!]!' }),
    ).toBeInTheDocument();

    // Expand Query.user and assert args and nested fields
    const userField = await screen.findByRole('button', { name: 'user: User' });
    await user.click(userField);
    await user.keyboard('{ArrowRight}');

    // Disambiguate using data attributes since labels can repeat
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

    // Expand Query.posts and assert nested Post fields
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

    // Expand Mutation and assert its field and args
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

    // Expand Subscription and assert its fields/args
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

    // Expand Subscription.postAdded and assert nested Post fields
    const postAddedField = document.querySelector(
      '[data-rct-item-id="__subscription.field.postAdded"]',
    ) as Element | null;
    expect(postAddedField).toBeInTheDocument();
    await user.click(postAddedField!);
    await user.keyboard('{ArrowRight}');
    expect(
      document.querySelector(
        '[data-rct-item-id="__subscription.field.postAdded.field.id"]',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-rct-item-id="__subscription.field.postAdded.field.title"]',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-rct-item-id="__subscription.field.postAdded.field.author"]',
      ),
    ).toBeInTheDocument();
  });
});
