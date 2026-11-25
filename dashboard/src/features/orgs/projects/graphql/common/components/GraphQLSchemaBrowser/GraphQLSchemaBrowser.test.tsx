import { buildSchema } from 'graphql';
import { createRef } from 'react';
import {
  act,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import GraphQLSchemaBrowser from './GraphQLSchemaBrowser';
import { createTestSchema } from './testSchema';
import type { SchemaSearchHandle, SchemaSearchResult } from './types';

async function findInTree(text: string) {
  return within(await screen.findByRole('tree')).findByText(text);
}

function getTreeItem(itemId: string) {
  return (
    document
      .querySelector(`[data-rct-item-id="${itemId}"]`)
      ?.closest('[role="treeitem"]') ?? null
  );
}

function renderBrowser() {
  const ref = createRef<SchemaSearchHandle>();
  const view = render(
    <GraphQLSchemaBrowser ref={ref} schema={createTestSchema()} />,
  );

  return { ref, ...view };
}

describe('GraphQLSchemaBrowser', () => {
  it('shows the operations and expands fields on click', async () => {
    const user = new TestUserEvent();

    render(<GraphQLSchemaBrowser schema={createTestSchema()} />);

    expect(await findInTree('Query')).toBeInTheDocument();
    expect(await findInTree('Mutation')).toBeInTheDocument();
    expect(screen.queryByText('users: [users!]!')).not.toBeInTheDocument();

    await user.click(await findInTree('Query'));
    await user.click(await findInTree('users: [users!]!'));

    expect(await screen.findByText('posts: [posts!]!')).toBeInTheDocument();
    expect(screen.getByText('deprecated')).toBeInTheDocument();
  });

  it('names the field an argument belongs to in the details', async () => {
    const user = new TestUserEvent();

    render(<GraphQLSchemaBrowser schema={createTestSchema()} />);

    await user.click(await findInTree('Query'));
    await user.click(await findInTree('users: [users!]!'));
    await user.click(await findInTree('posts: [posts!]!'));
    await user.click(await findInTree('limit: Int'));

    expect(
      within(screen.getByRole('complementary', { name: 'Details' })).getByText(
        'Argument on users.posts',
      ),
    ).toBeInTheDocument();
  });

  it('reveals and selects the first match', async () => {
    const { ref } = renderBrowser();

    let result: SchemaSearchResult | null = null;
    act(() => {
      result = ref.current!.find('title');
    });

    expect(result).toEqual({ count: 2, index: 0 });
    await waitFor(() =>
      expect(getTreeItem('query/users/posts/@where/title')).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
  });

  it('steps through matches in a loop', async () => {
    const { ref } = renderBrowser();

    act(() => {
      ref.current!.find('title');
    });

    let result: SchemaSearchResult | null = null;
    act(() => {
      result = ref.current!.next();
    });

    expect(result).toEqual({ count: 2, index: 1 });
    await waitFor(() =>
      expect(getTreeItem('query/users/posts/title')).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );

    act(() => {
      result = ref.current!.next();
    });

    expect(result).toEqual({ count: 2, index: 0 });

    act(() => {
      result = ref.current!.previous();
    });

    expect(result).toEqual({ count: 2, index: 1 });
  });

  it('scrolls to the match again when the same match is shown again', async () => {
    const { scrollIntoView } = window.HTMLElement.prototype;
    const scrollSpy = vi.fn();

    window.HTMLElement.prototype.scrollIntoView = scrollSpy;
    onTestFinished(() => {
      window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    });

    const { ref } = renderBrowser();

    act(() => {
      ref.current!.find('displayName');
    });

    await waitFor(() =>
      expect(getTreeItem('query/users/displayName')).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockClear();

    let result: SchemaSearchResult | null = null;
    act(() => {
      result = ref.current!.next();
    });

    expect(result).toEqual({ count: 1, index: 0 });
    await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
  });

  it('reports when nothing matches', () => {
    const { ref } = renderBrowser();

    let result: SchemaSearchResult | null = null;
    act(() => {
      result = ref.current!.find('nothing-like-this');
    });

    expect(result).toEqual({ count: 0, index: 0 });
    expect(ref.current!.next()).toBeNull();
  });

  it('removes the highlights and the matches when the search is cleared', async () => {
    const { ref } = renderBrowser();

    act(() => {
      ref.current!.find('title');
    });

    await waitFor(() =>
      expect(
        screen.getByRole('tree').querySelectorAll('mark').length,
      ).toBeGreaterThan(0),
    );

    act(() => {
      ref.current!.clear();
    });

    await waitFor(() =>
      expect(screen.getByRole('tree').querySelectorAll('mark')).toHaveLength(0),
    );
    expect(getTreeItem('query/users/posts/@where/title')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(ref.current!.next()).toBeNull();
  });

  it('resets the tree and the matches when the schema changes', async () => {
    const { ref, rerender } = renderBrowser();

    act(() => {
      ref.current!.find('title');
    });

    rerender(
      <GraphQLSchemaBrowser
        ref={ref}
        schema={buildSchema('type Query { ping: String }')}
      />,
    );

    await waitFor(() => expect(getTreeItem('query/users')).toBeNull());
    expect(screen.queryByText('Mutation')).not.toBeInTheDocument();
    expect(ref.current!.next()).toBeNull();
  });
});
