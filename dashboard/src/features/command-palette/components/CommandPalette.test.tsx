import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { vi } from 'vitest';

import { CommandPalette } from '@/features/command-palette/components/CommandPalette';
import type { CommandNode, ScoredNode } from '@/features/command-palette/types';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, waitFor, within } from '@/tests/testUtils';

const toItem = (
  commandNode: CommandNode,
  titleRanges: ScoredNode['titleRanges'] = [],
): ScoredNode => ({
  node: commandNode,
  score: 0,
  titleRanges,
});

const makeNode = (
  overrides: Partial<CommandNode> & Pick<CommandNode, 'id'>,
) => ({
  title: overrides.id,
  kind: 'page' as const,
  ...overrides,
});

const database = makeNode({
  id: 'database',
  title: 'Database',
  path: 'database/browser/default',
});
const logs = makeNode({ id: 'logs', title: 'Logs', path: 'logs' });
const settings = makeNode({
  id: 'settings',
  title: 'Settings',
  kind: 'setting',
});
const project = makeNode({
  id: 'project-a',
  title: 'Project A',
  kind: 'project',
});
const container = makeNode({
  id: 'data-group',
  title: 'Data',
  kind: 'group',
  children: [database, settings],
});

interface RenderPaletteArgs {
  query?: string;
  items?: ScoredNode[];
  scopeStack?: CommandNode[];
  scopeTouched?: boolean;
  recentItems?: ScoredNode[];
  pageItems?: ScoredNode[];
  orgProjectItems?: ScoredNode[];
  onDrill?: (node: CommandNode) => void;
  onNavigate?: (node: CommandNode) => void;
  onPopScope?: VoidFunction;
  onPopTo?: (index: number) => void;
}

const renderPalette = ({
  query = 'data',
  items = [toItem(database), toItem(logs)],
  scopeStack = [],
  scopeTouched = false,
  recentItems = [],
  pageItems = [],
  orgProjectItems = [],
  onDrill = vi.fn(),
  onNavigate = vi.fn(),
  onPopScope = vi.fn(),
  onPopTo = vi.fn(),
}: RenderPaletteArgs = {}) => {
  const onQueryChange = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <CommandPalette
      items={items}
      onDrill={onDrill}
      onNavigate={onNavigate}
      onOpenChange={onOpenChange}
      onPopScope={onPopScope}
      onPopTo={onPopTo}
      onQueryChange={onQueryChange}
      open
      orgProjectItems={orgProjectItems}
      pageItems={pageItems}
      query={query}
      rootPlaceholder="Search pages, settings, docs..."
      recentItems={recentItems}
      scopeStack={scopeStack}
      scopeTouched={scopeTouched}
    />,
  );

  return {
    onDrill,
    onNavigate,
    onOpenChange,
    onPopScope,
    onPopTo,
    onQueryChange,
  };
};

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
  toast.remove();
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.scrollTo = vi.fn();
});

describe('CommandPalette', () => {
  it('renders pre-scored items in the provided DOM order', () => {
    renderPalette({
      items: [toItem(logs), toItem(database), toItem(settings)],
      query: 's',
    });

    const rows = screen.getAllByRole('option');

    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Logs'),
      expect.stringContaining('Database'),
      expect.stringContaining('Settings'),
    ]);
  });

  it('emits drill intent so the host can push a scope and narrow the list', async () => {
    const Host = () => {
      const [scopeStack, setScopeStack] = useState<CommandNode[]>([]);
      const visibleItems =
        scopeStack.length > 0
          ? [toItem(database), toItem(settings)]
          : [toItem(container), toItem(logs)];

      return (
        <CommandPalette
          items={visibleItems}
          onDrill={(selectedNode) => setScopeStack([selectedNode])}
          onNavigate={vi.fn()}
          onOpenChange={vi.fn()}
          onPopScope={() => setScopeStack([])}
          onPopTo={(index) => setScopeStack((stack) => stack.slice(0, index))}
          onQueryChange={vi.fn()}
          open
          orgProjectItems={[]}
          pageItems={[toItem(container), toItem(logs)]}
          query=""
          rootPlaceholder="Search pages, settings, docs..."
          recentItems={[]}
          scopeStack={scopeStack}
          scopeTouched={scopeStack.length > 0}
        />
      );
    };

    render(<Host />);

    await user.keyboard('{ArrowRight}');

    expect(await screen.findByTitle('Data')).toHaveTextContent('Data');
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  it('lets ArrowRight move the caret mid-query without drilling', async () => {
    const onDrill = vi.fn();
    renderPalette({
      items: [toItem(container)],
      onDrill,
      query: 'data',
    });
    const input = screen.getByRole('combobox') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(1, 1);

    await user.keyboard('{ArrowRight}');

    expect(input).toHaveProperty('selectionStart', 2);
    expect(onDrill).not.toHaveBeenCalled();
  });

  it('drills with ArrowRight only when the caret is at the end', async () => {
    const onDrill = vi.fn();
    renderPalette({
      items: [toItem(container)],
      onDrill,
      query: 'data',
    });
    const input = screen.getByRole('combobox') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    await user.keyboard('{ArrowRight}');
    expect(onDrill).toHaveBeenCalledWith(container);
  });

  it('does not swallow Shift+Tab and keeps focus inside after Tab drill', async () => {
    const onDrill = vi.fn();
    renderPalette({
      pageItems: [toItem(container)],
      onDrill,
      query: '',
    });
    const input = screen.getByRole('combobox');
    input.focus();

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(onDrill).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);

    input.focus();
    await user.keyboard('{Tab}');

    await waitFor(() => expect(onDrill).toHaveBeenCalledWith(container));
    expect(document.activeElement).toBe(input);
  });

  it('pops scope with Backspace only when the query is empty', async () => {
    const onPopScope = vi.fn();
    const { rerender } = render(
      <CommandPalette
        items={[toItem(database)]}
        onDrill={vi.fn()}
        onNavigate={vi.fn()}
        onOpenChange={vi.fn()}
        onPopScope={onPopScope}
        onPopTo={vi.fn()}
        onQueryChange={vi.fn()}
        open
        orgProjectItems={[]}
        pageItems={[]}
        query="data"
        rootPlaceholder="Search pages, settings, docs..."
        recentItems={[]}
        scopeStack={[container]}
        scopeTouched
      />,
    );
    const input = screen.getByRole('combobox');
    input.focus();

    await user.keyboard('{Backspace}');
    expect(onPopScope).not.toHaveBeenCalled();

    rerender(
      <CommandPalette
        items={[toItem(database)]}
        onDrill={vi.fn()}
        onNavigate={vi.fn()}
        onOpenChange={vi.fn()}
        onPopScope={onPopScope}
        onPopTo={vi.fn()}
        onQueryChange={vi.fn()}
        open
        orgProjectItems={[]}
        pageItems={[]}
        query=""
        rootPlaceholder="Search pages, settings, docs..."
        recentItems={[]}
        scopeStack={[container]}
        scopeTouched
      />,
    );

    screen.getByRole('combobox').focus();
    await user.keyboard('{Backspace}');
    expect(onPopScope).toHaveBeenCalledTimes(1);
  });

  it('uses cmdk arrow navigation and Enter to navigate the selected leaf', async () => {
    const onNavigate = vi.fn();
    renderPalette({
      items: [toItem(database), toItem(logs)],
      onNavigate,
      query: 'data',
    });
    const input = screen.getByRole('combobox');
    input.focus();
    const scrollIntoView = vi.mocked(
      window.HTMLElement.prototype.scrollIntoView,
    );
    scrollIntoView.mockClear();

    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(logs));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('resets the selection to the top result and scrolls up when the query changes', async () => {
    const Host = () => {
      const [query, setQuery] = useState('data');

      return (
        <CommandPalette
          items={[toItem(database), toItem(logs)]}
          onDrill={vi.fn()}
          onNavigate={vi.fn()}
          onOpenChange={vi.fn()}
          onPopScope={vi.fn()}
          onPopTo={vi.fn()}
          onQueryChange={setQuery}
          open
          orgProjectItems={[]}
          pageItems={[]}
          query={query}
          rootPlaceholder="Search pages, settings, docs..."
          recentItems={[]}
          scopeStack={[]}
          scopeTouched={false}
        />
      );
    };

    render(<Host />);
    const input = screen.getByRole('combobox');
    input.focus();

    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Logs/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    const scrollTo = vi.mocked(window.HTMLElement.prototype.scrollTo);
    scrollTo.mockClear();

    await user.clear(input);
    await user.type(input, 'log');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Database/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it('resets the selection to the top result after closing and reopening', async () => {
    const paletteProps = {
      items: [toItem(database), toItem(logs)],
      onDrill: vi.fn(),
      onNavigate: vi.fn(),
      onOpenChange: vi.fn(),
      onPopScope: vi.fn(),
      onPopTo: vi.fn(),
      onQueryChange: vi.fn(),
      orgProjectItems: [],
      pageItems: [],
      query: 'data',
      recentItems: [],
      rootPlaceholder: 'Search pages, settings, docs...',
      scopeStack: [],
      scopeTouched: false,
    };
    const { rerender } = render(<CommandPalette {...paletteProps} open />);
    screen.getByRole('combobox').focus();

    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Logs/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    rerender(<CommandPalette {...paletteProps} open={false} />);
    rerender(<CommandPalette {...paletteProps} open />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Database/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('keeps same-titled nodes independently selectable by id', async () => {
    const firstSettings = makeNode({
      id: 'project-settings',
      title: 'Settings',
    });
    const secondSettings = makeNode({ id: 'org-settings', title: 'Settings' });
    const onNavigate = vi.fn();
    renderPalette({
      items: [toItem(firstSettings), toItem(secondSettings)],
      onNavigate,
      query: 'settings',
    });

    await user.click(screen.getAllByRole('option', { name: /Settings/ })[1]);

    expect(onNavigate).toHaveBeenCalledWith(secondSettings);
  });

  it('renders curated root sections from props', () => {
    renderPalette({
      items: [],
      pageItems: [toItem(database)],
      query: '',
      recentItems: [toItem(logs)],
      orgProjectItems: [toItem(project)],
    });

    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByText('Organizations & Projects')).toBeInTheDocument();
    expect(screen.getByText('Project A')).toBeInTheDocument();
  });

  it('navigates on Enter for containers with a destination and drills with Tab', async () => {
    const containerWithPath = makeNode({
      id: 'database-group',
      title: 'Database',
      kind: 'group',
      path: 'database/browser/default',
      children: [database],
    });
    const onDrill = vi.fn();
    const onNavigate = vi.fn();
    renderPalette({
      items: [toItem(containerWithPath)],
      onDrill,
      onNavigate,
      query: 'data',
    });
    const input = screen.getByRole('combobox');
    input.focus();

    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith(containerWithPath),
    );
    expect(onDrill).not.toHaveBeenCalled();

    await user.keyboard('{Tab}');

    await waitFor(() =>
      expect(onDrill).toHaveBeenCalledWith(containerWithPath),
    );
  });

  it('renders the scope trail in the input and pops back to a clicked ancestor', async () => {
    const onPopTo = vi.fn();
    renderPalette({
      items: [toItem(database)],
      onPopTo,
      query: '',
      scopeStack: [project, container],
    });

    expect(
      screen.getByRole('button', { name: /go back to project a scope/i }),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Data')).toHaveTextContent('Data');
    // Only ancestors are clickable; the innermost scope pops via Backspace.
    expect(
      screen.queryByRole('button', { name: /go back to data scope/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /go back to project a scope/i }),
    );

    expect(onPopTo).toHaveBeenCalledWith(1);
  });

  it('shows the breadcrumb trail instead of the raw route', () => {
    const metadata = makeNode({
      id: 'graphql-metadata',
      title: 'Metadata',
      path: 'graphql/metadata',
      breadcrumb: ['GraphQL'],
    });
    renderPalette({ items: [toItem(metadata), toItem(database)], query: 'a' });

    const row = screen.getByRole('option', { name: /Metadata/ });

    expect(within(row).getByText('GraphQL › Metadata')).toBeInTheDocument();
    expect(screen.queryByText('graphql/metadata')).not.toBeInTheDocument();
    // Top-level rows have no trail and drop the raw route subtitle.
    expect(
      screen.queryByText('database/browser/default'),
    ).not.toBeInTheDocument();
  });

  it('renders the project hint alongside the trail', () => {
    const metadata = makeNode({
      id: 'graphql-metadata',
      title: 'Metadata',
      path: 'graphql/metadata',
      breadcrumb: ['GraphQL'],
      hint: 'Org B / Project C (project-c)',
    });
    renderPalette({ items: [toItem(metadata)], query: 'meta' });

    const row = screen.getByRole('option', { name: /Metadata/ });

    expect(
      within(row).getByText('Org B / Project C (project-c)'),
    ).toBeInTheDocument();
    expect(within(row).getByText('GraphQL › Metadata')).toBeInTheDocument();
  });

  it('keeps the external URL as the docs row subtitle', () => {
    const docs = makeNode({
      id: 'docs',
      title: 'Docs',
      kind: 'doc',
      path: 'https://docs.nhost.io',
      scope: 'external',
    });
    renderPalette({ items: [toItem(docs)], query: 'docs' });

    expect(
      within(screen.getByRole('option', { name: /Docs/ })).getByText(
        'https://docs.nhost.io',
      ),
    ).toBeInTheDocument();
  });

  it('highlights title match ranges only', () => {
    renderPalette({
      items: [toItem(database, [[0, 4]])],
      query: 'data',
    });

    expect(
      screen.getByTestId('command-palette-title-highlight'),
    ).toHaveTextContent('Data');
  });

  it('renders the empty state when no scored rows are provided', () => {
    renderPalette({ items: [], query: 'missing' });

    expect(screen.getByText('No results for “missing”')).toBeInTheDocument();
    expect(
      screen.getByText('Try searching for a setting, action, or project.'),
    ).toBeInTheDocument();
  });

  it('renders the footer with the result count and contextual legend', () => {
    renderPalette({ items: [toItem(database), toItem(logs)], query: 'data' });

    expect(screen.getByText('Nhost')).toBeInTheDocument();
    expect(screen.getByText('2 results')).toBeInTheDocument();
    expect(screen.getByText('navigate')).toBeInTheDocument();
    expect(screen.getByText('close')).toBeInTheDocument();
    expect(screen.queryByText('select')).not.toBeInTheDocument();
    expect(screen.queryByText('drill')).not.toBeInTheDocument();
    expect(screen.queryByText('back')).not.toBeInTheDocument();
  });

  it('shows the back hint only while scoped', () => {
    renderPalette({
      items: [toItem(database)],
      query: '',
      scopeStack: [container],
    });

    expect(screen.getByText('back')).toBeInTheDocument();
  });

  it('shows contextual key hints only on the focused row', async () => {
    renderPalette({ items: [toItem(database), toItem(logs)], query: 'a' });

    const databaseRow = screen.getByRole('option', { name: /Database/ });
    await waitFor(() => {
      expect(databaseRow).toHaveAttribute('aria-selected', 'true');
    });

    expect(screen.getAllByText('to jump to')).toHaveLength(1);
    expect(within(databaseRow).getByText('to jump to')).toBeInTheDocument();
    expect(screen.queryByText('to search')).not.toBeInTheDocument();
  });

  it('shows both hints for a focused container with a destination', async () => {
    const containerWithPath = makeNode({
      id: 'database-group',
      title: 'Database',
      kind: 'group',
      path: 'database/browser/default',
      children: [database],
    });
    renderPalette({ items: [toItem(containerWithPath)], query: 'data' });

    const row = screen.getByRole('option', { name: /Database/ });
    await waitFor(() => {
      expect(row).toHaveAttribute('aria-selected', 'true');
    });

    expect(within(row).getByText('to jump to')).toBeInTheDocument();
    expect(within(row).getByText('to search')).toBeInTheDocument();
  });

  it('singularizes the footer result count', () => {
    renderPalette({ items: [toItem(database)], query: 'data' });

    expect(screen.getByText('1 result')).toBeInTheDocument();
  });

  it('includes an accessible hidden title and description', () => {
    renderPalette();

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('Command palette')).toHaveClass('sr-only');
    expect(
      within(dialog).getByText('Search and navigate dashboard pages.'),
    ).toHaveClass('sr-only');
  });
});
