import { useState } from 'react';
import toast from 'react-hot-toast';
import { vi } from 'vitest';

import { CommandPalette } from '@/features/command-palette/components/CommandPalette';
import type { CommandNode, ScoredNode } from '@/features/command-palette/types';
import { fireEvent, render, screen, waitFor, within } from '@/tests/testUtils';

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

const database = makeNode({ id: 'database', title: 'Database' });
const logs = makeNode({ id: 'logs', title: 'Logs' });
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
const docs = makeNode({ id: 'docs', title: 'Docs', kind: 'doc' });
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
  recentItems?: ScoredNode[];
  suggestedItems?: ScoredNode[];
  pageItems?: ScoredNode[];
  switchItems?: ScoredNode[];
  onDrill?: (node: CommandNode) => void;
  onNavigate?: (node: CommandNode) => void;
  onPopScope?: VoidFunction;
}

const renderPalette = ({
  query = 'data',
  items = [toItem(database), toItem(logs)],
  scopeStack = [],
  recentItems,
  suggestedItems,
  pageItems,
  switchItems,
  onDrill = vi.fn(),
  onNavigate = vi.fn(),
  onPopScope = vi.fn(),
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
      onQueryChange={onQueryChange}
      open
      pageItems={pageItems}
      query={query}
      recentItems={recentItems}
      scopeStack={scopeStack}
      suggestedItems={suggestedItems}
      switchItems={switchItems}
    />,
  );

  return { onDrill, onNavigate, onOpenChange, onPopScope, onQueryChange };
};

beforeEach(() => {
  toast.remove();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
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

  it('emits drill intent so the host can push a chip and narrow the list', async () => {
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
          onQueryChange={vi.fn()}
          open
          query=""
          scopeStack={scopeStack}
        />
      );
    };

    render(<Host />);

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowRight' });

    expect(
      await screen.findByRole('button', { name: /leave data scope/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  it('lets ArrowRight move the caret mid-query without drilling', () => {
    const onDrill = vi.fn();
    renderPalette({
      items: [toItem(container)],
      onDrill,
      query: 'data',
    });
    const input = screen.getByRole('combobox') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(1, 1);

    const wasNotPrevented = fireEvent.keyDown(input, { key: 'ArrowRight' });

    expect(wasNotPrevented).toBe(true);
    expect(onDrill).not.toHaveBeenCalled();
  });

  it('drills with ArrowRight only when the caret is at the end', () => {
    const onDrill = vi.fn();
    renderPalette({
      items: [toItem(container)],
      onDrill,
      query: 'data',
    });
    const input = screen.getByRole('combobox') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    const wasNotPrevented = fireEvent.keyDown(input, { key: 'ArrowRight' });

    expect(wasNotPrevented).toBe(false);
    expect(onDrill).toHaveBeenCalledWith(container);
  });

  it('does not swallow Shift+Tab and keeps focus inside after Tab drill', async () => {
    const onDrill = vi.fn();
    renderPalette({
      items: [toItem(container)],
      onDrill,
      query: '',
    });
    const input = screen.getByRole('combobox');
    input.focus();

    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(onDrill).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);

    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(false);

    await waitFor(() => expect(onDrill).toHaveBeenCalledWith(container));
    expect(document.activeElement).toBe(input);
  });

  it('pops scope with Backspace only when the query is empty', () => {
    const onPopScope = vi.fn();
    const { rerender } = render(
      <CommandPalette
        items={[toItem(database)]}
        onDrill={vi.fn()}
        onNavigate={vi.fn()}
        onOpenChange={vi.fn()}
        onPopScope={onPopScope}
        onQueryChange={vi.fn()}
        open
        query="data"
        scopeStack={[container]}
      />,
    );
    const input = screen.getByRole('combobox');

    expect(fireEvent.keyDown(input, { key: 'Backspace' })).toBe(true);
    expect(onPopScope).not.toHaveBeenCalled();

    rerender(
      <CommandPalette
        items={[toItem(database)]}
        onDrill={vi.fn()}
        onNavigate={vi.fn()}
        onOpenChange={vi.fn()}
        onPopScope={onPopScope}
        onQueryChange={vi.fn()}
        open
        query=""
        scopeStack={[container]}
      />,
    );

    expect(
      fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' }),
    ).toBe(false);
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

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(logs));
  });

  it('keeps same-titled nodes independently selectable by id', () => {
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

    fireEvent.click(screen.getByTestId('command-palette-item-org-settings'));

    expect(onNavigate).toHaveBeenCalledWith(secondSettings);
  });

  it('renders curated root sections from props', () => {
    renderPalette({
      items: [],
      pageItems: [toItem(database)],
      query: '',
      recentItems: [toItem(logs)],
      suggestedItems: [toItem(docs)],
      switchItems: [toItem(project)],
    });

    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('Suggested')).toBeInTheDocument();
    expect(screen.getByText('Pages')).toBeInTheDocument();
    expect(screen.getByText('Switch')).toBeInTheDocument();
    expect(screen.getByText('Project A')).toBeInTheDocument();
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

  it('renders the footer with the result count and shortcut legend', () => {
    renderPalette({ items: [toItem(database), toItem(logs)], query: 'data' });

    expect(screen.getByText('Nhost')).toBeInTheDocument();
    expect(screen.getByText('2 results')).toBeInTheDocument();
    expect(screen.getByText('navigate')).toBeInTheDocument();
    expect(screen.getByText('select')).toBeInTheDocument();
    expect(screen.getByText('back')).toBeInTheDocument();
    expect(screen.getByText('close')).toBeInTheDocument();
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
