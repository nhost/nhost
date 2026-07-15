import { Search } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Logo } from '@/components/presentational/Logo';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
} from '@/components/ui/v3/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { CommandRow } from '@/features/command-palette/components/CommandRow';
import { useAnimatedHeight } from '@/features/command-palette/hooks/useAnimatedHeight';
import { isContainer } from '@/features/command-palette/lib/machine';
import type { CommandNode, ScoredNode } from '@/features/command-palette/types';
import { cn } from '@/lib/utils';

interface CommandPaletteSection {
  id: string;
  title: string;
  items: ScoredNode[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  items: ScoredNode[];
  scopeStack: CommandNode[];
  onPopScope: VoidFunction;
  onPopTo: (index: number) => void;
  onDrill: (node: CommandNode) => void;
  onNavigate: (node: CommandNode) => void;
  recentItems?: ScoredNode[];
  pageItems?: ScoredNode[];
  orgProjectItems?: ScoredNode[];
  className?: string;
}

const kindGroupTitles: Record<CommandNode['kind'], string> = {
  page: 'Pages',
  group: 'Groups',
  setting: 'Settings',
  org: 'Organizations',
  project: 'Projects',
  doc: 'Docs',
};

const footerHintClassName =
  'inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-[11px] text-muted-foreground';

const getGroupedSections = (items: ScoredNode[]): CommandPaletteSection[] => {
  const groups = new Map<CommandNode['kind'], ScoredNode[]>();

  for (const item of items) {
    const group = groups.get(item.node.kind);

    if (group) {
      group.push(item);
    } else {
      groups.set(item.node.kind, [item]);
    }
  }

  return Array.from(groups, ([kind, groupedItems]) => ({
    id: kind,
    title: kindGroupTitles[kind],
    items: groupedItems,
  }));
};

interface GetCommandPaletteSectionsArgs {
  queryIsEmpty: boolean;
  currentScope?: CommandNode;
  items: ScoredNode[];
  recentItems: ScoredNode[];
  pageItems: ScoredNode[];
  orgProjectItems: ScoredNode[];
}

const getCommandPaletteSections = ({
  queryIsEmpty,
  currentScope,
  items,
  recentItems,
  pageItems,
  orgProjectItems,
}: GetCommandPaletteSectionsArgs): CommandPaletteSection[] => {
  if (queryIsEmpty && !currentScope) {
    const injectedSections = [
      { id: 'recent', title: 'Recent', items: recentItems },
      { id: 'pages', title: 'Pages', items: pageItems },
      {
        id: 'orgs-projects',
        title: 'Organizations & Projects',
        items: orgProjectItems,
      },
    ].filter((section) => section.items.length > 0);

    return injectedSections.length > 0
      ? injectedSections
      : [{ id: 'items', title: 'Pages', items }];
  }

  if (queryIsEmpty && currentScope) {
    return items.length > 0
      ? [{ id: 'scope', title: currentScope.title, items }]
      : [];
  }

  return getGroupedSections(items);
};

const getSelectedNode = (
  sections: CommandPaletteSection[],
  selectedValue: string,
) => {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.node.id === selectedValue) {
        return item.node;
      }
    }
  }

  return undefined;
};

interface CommandPaletteItemsProps {
  sections: CommandPaletteSection[];
  onSelectNode: (node: CommandNode) => void;
  selectedValue: string;
}

const CommandPaletteItems = ({
  sections,
  onSelectNode,
  selectedValue,
}: CommandPaletteItemsProps) =>
  sections.map((section, index) => (
    <CommandGroup heading={section.title} key={section.id}>
      {section.items.map((item) => (
        <CommandRow
          item={item}
          key={item.node.id}
          onSelect={onSelectNode}
          selected={item.node.id === selectedValue}
        />
      ))}
      {index < sections.length - 1 && <CommandSeparator />}
    </CommandGroup>
  ));

export const CommandPalette = ({
  open,
  onOpenChange,
  query,
  onQueryChange,
  items,
  scopeStack,
  onPopScope,
  onPopTo,
  onDrill,
  onNavigate,
  recentItems = [],
  pageItems = [],
  orgProjectItems = [],
  className,
}: CommandPaletteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { contentRef, height, animate } = useAnimatedHeight<HTMLDivElement>();
  const [selectedValue, setSelectedValue] = useState<string>('');
  const currentScope = scopeStack.at(-1);
  const trimmedQuery = query.trim();
  const queryIsEmpty = trimmedQuery.length === 0;

  const sections = useMemo<CommandPaletteSection[]>(() => {
    return getCommandPaletteSections({
      queryIsEmpty,
      currentScope,
      items,
      recentItems,
      pageItems,
      orgProjectItems,
    });
  }, [
    currentScope,
    items,
    orgProjectItems,
    pageItems,
    queryIsEmpty,
    recentItems,
  ]);

  const selectedNode = useMemo(
    () => getSelectedNode(sections, selectedValue),
    [sections, selectedValue],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: selection and scroll reset to the top result only when the query or scope changes
  useEffect(() => {
    setSelectedValue(sections[0]?.items[0]?.node.id ?? '');
    listRef.current?.scrollTo({ top: 0 });
  }, [trimmedQuery, currentScope]);

  useEffect(() => {
    if (!selectedNode) {
      setSelectedValue(sections[0]?.items[0]?.node.id ?? '');
    }
  }, [selectedNode, sections]);

  const handleDrill = (node: CommandNode) => {
    onDrill(node);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  // The clicked crumb leaves the DOM (or turns into plain text), so focus
  // would otherwise fall back to the body.
  const handlePopTo = (index: number) => {
    onPopTo(index);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const selectNode = (node: CommandNode) => {
    if (isContainer(node) && node.path === undefined) {
      handleDrill(node);
      return;
    }

    onNavigate(node);
  };

  const drillSelectedNode = () => {
    if (!selectedNode || !isContainer(selectedNode)) {
      return false;
    }

    handleDrill(selectedNode);
    return true;
  };

  const handleInputKeyDownCapture = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget;

    // Custom drill/pop keys must run before cmdk/Dialog bubble handlers.
    if (event.key === 'Backspace') {
      if (queryIsEmpty && currentScope) {
        event.preventDefault();
        onPopScope();
      }

      return;
    }

    if (event.key === 'Tab') {
      if (event.shiftKey || !drillSelectedNode()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key !== 'ArrowRight') {
      return;
    }

    const caretAtEnd =
      input.selectionStart === input.selectionEnd &&
      input.selectionEnd === input.value.length;

    if (!caretAtEnd || !drillSelectedNode()) {
      return;
    }

    event.preventDefault();
  };

  const resultCount = sections.reduce(
    (total, section) => total + section.items.length,
    0,
  );
  const hasItems = resultCount > 0;

  // GitHub-style scope trail inside the input: ancestors pop back to their
  // level on click, the innermost scope is plain text and pops via Backspace.
  const scopeTrail =
    scopeStack.length > 0
      ? scopeStack.map((scope, index) => (
          <Fragment key={scope.id}>
            {index < scopeStack.length - 1 ? (
              <button
                aria-label={`Go back to ${scope.title} scope`}
                className="min-w-0 truncate rounded-sm font-medium text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="command-palette-scope-crumb"
                onClick={() => handlePopTo(index + 1)}
                tabIndex={-1}
                title={scope.title}
                type="button"
              >
                {scope.title}
              </button>
            ) : (
              <span
                className="min-w-0 truncate font-medium text-foreground"
                data-testid="command-palette-scope-crumb"
                title={scope.title}
              >
                {scope.title}
              </span>
            )}
            <span aria-hidden="true" className="shrink-0">
              /
            </span>
          </Fragment>
        ))
      : undefined;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className={cn(
          'overflow-hidden px-0 py-2 shadow-lg sm:max-w-2xl',
          className,
        )}
        hideCloseButton
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search and navigate dashboard pages.
        </DialogDescription>
        <Command
          className="rounded-lg [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5"
          onValueChange={setSelectedValue}
          shouldFilter={false}
          value={selectedValue}
        >
          <CommandInput
            aria-label="Search dashboard"
            onKeyDownCapture={handleInputKeyDownCapture}
            onValueChange={onQueryChange}
            placeholder={
              currentScope ? 'Search...' : 'Search pages, settings, projects...'
            }
            className="w-auto min-w-24 flex-1"
            prefix={scopeTrail}
            prefixClassName="mr-1.5 flex min-w-0 items-center gap-1.5 text-sm"
            ref={inputRef}
            value={query}
          />
          <div
            className={cn(
              'min-h-0 overflow-hidden',
              animate && 'transition-[height] duration-200 ease-out',
            )}
            style={{ height }}
          >
            <div ref={contentRef}>
              <CommandList className="mt-2 max-h-[420px]" ref={listRef}>
                {!hasItems && (
                  <CommandEmpty className="flex min-h-[300px] items-center justify-center px-6 py-10">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="mb-3 flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Search
                          aria-hidden="true"
                          className="h-6 w-6 text-foreground"
                        />
                      </div>
                      <p className="text-foreground text-sm">
                        {trimmedQuery
                          ? `No results for “${trimmedQuery}”`
                          : 'No results'}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Try searching for a setting, action, or project.
                      </p>
                    </div>
                  </CommandEmpty>
                )}
                <CommandPaletteItems
                  onSelectNode={selectNode}
                  sections={sections}
                  selectedValue={selectedValue}
                />
              </CommandList>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-muted-foreground text-xs">
            <div className="flex items-center gap-1.5">
              <Logo className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">Nhost</span>
              <span aria-hidden="true">·</span>
              <span>
                {resultCount} {resultCount === 1 ? 'result' : 'results'}
              </span>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <span className="flex items-center gap-1">
                <kbd className={footerHintClassName}>↑</kbd>
                <kbd className={footerHintClassName}>↓</kbd>
                <span>navigate</span>
              </span>
              {currentScope && (
                <span className="flex items-center gap-1">
                  <kbd className={footerHintClassName}>⌫</kbd>
                  <span>back</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <kbd className={footerHintClassName}>esc</kbd>
                <span>close</span>
              </span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
