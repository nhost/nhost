import {
  DOC_EXPLORER_PLUGIN,
  DocExplorer,
  type ExplorerNavStackItem,
  type GraphiQLPlugin,
  useEditorContext,
  useExecutionContext,
  useExplorerContext,
  usePluginContext,
  useSchemaContext,
} from '@graphiql/react';
import { type GraphQLField, isInterfaceType, isObjectType } from 'graphql';
import { BookOpen, ChevronRight, History, Plus } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { QueryHistory } from '@/features/orgs/projects/graphql/common/components/QueryHistory';
import {
  buildFieldSnippet,
  buildTableQuery,
} from '@/features/orgs/projects/graphql/common/utils/buildDocsSnippet';
import { getDocsKind } from '@/features/orgs/projects/graphql/common/utils/describeSchemaType';
import { openQueryInTab } from '@/features/orgs/projects/graphql/common/utils/openQueryInTab';
import { cn } from '@/lib/utils';
import { triggerToast } from '@/utils/toast';
import SchemaTypeGroups from './SchemaTypeGroups';

export type PlaygroundPanelTab = 'response' | 'history' | 'docs';

// History and Docs are tabs of the response pane. GraphiQL's plugin state
// says which one is open (none means Response), so a Ctrl+click on a field in
// the editor still opens its docs. The plugins render nothing themselves:
// the response pane shows them. GraphiQL registers its own History and
// Documentation Explorer plugins, so ours need other titles.
export const HISTORY_PANEL_PLUGIN: GraphiQLPlugin = {
  title: 'Query history',
  icon: History,
  content: () => null,
};

export const DOCS_PANEL_PLUGIN: GraphiQLPlugin = {
  title: 'Schema docs',
  icon: BookOpen,
  content: () => null,
};

// On a phone only one pane fits: the query, or the response pane (on its
// Response, History or Docs tab). Desktop shows both and ignores this.
const MobileQueryViewContext = createContext<{
  showQuery: boolean;
  setShowQuery: (showQuery: boolean) => void;
}>({ showQuery: true, setShowQuery: () => {} });

export const useMobileQueryView = () => useContext(MobileQueryViewContext);

/**
 * Holds which pane a phone shows. `display: contents` keeps GraphiQL's
 * layout as is; the attribute lets the stylesheet hide the other pane.
 */
export function MobileQueryViewProvider({ children }: { children: ReactNode }) {
  const [showQuery, setShowQuery] = useState(true);

  return (
    <MobileQueryViewContext.Provider value={{ showQuery, setShowQuery }}>
      <div
        className="contents"
        data-mobile-view={showQuery ? 'query' : 'panel'}
      >
        {children}
      </div>
    </MobileQueryViewContext.Provider>
  );
}

/** The open tab of the response pane, and a way to switch it. */
export function usePlaygroundPanelTab() {
  const pluginContext = usePluginContext();
  const title = pluginContext?.visiblePlugin?.title;

  // GraphiQL opens its own docs on a Ctrl+click in the editor: show ours.
  useEffect(() => {
    if (title === DOC_EXPLORER_PLUGIN.title) {
      pluginContext?.setVisiblePlugin(DOCS_PANEL_PLUGIN);
    }
  }, [title, pluginContext]);

  let tab: PlaygroundPanelTab = 'response';

  if (title === HISTORY_PANEL_PLUGIN.title) {
    tab = 'history';
  } else if (
    title === DOCS_PANEL_PLUGIN.title ||
    title === DOC_EXPLORER_PLUGIN.title
  ) {
    tab = 'docs';
  }

  function setTab(next: PlaygroundPanelTab) {
    pluginContext?.setVisiblePlugin(
      {
        response: null,
        history: HISTORY_PANEL_PLUGIN,
        docs: DOCS_PANEL_PLUGIN,
      }[next],
    );
  }

  return [tab, setTab] as const;
}

export function PanelTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      // Same look as the Variables and Headers tabs. GraphiQL's stylesheet
      // colors every button inside it, hence the important colors.
      className={cn(
        'hover:!text-primary flex h-full items-center gap-2 border-b-2 font-semibold text-sm transition-colors',
        active
          ? '!text-primary border-primary'
          : '!text-muted-foreground border-transparent',
      )}
    >
      {children}
    </button>
  );
}

type AnyField = GraphQLField<unknown, unknown>;

interface FieldCopyTarget {
  slot: HTMLElement;
  field: AnyField;
}

const COPY_SLOT_CLASS = 'playground-copy-slot';

// The fields GraphiQL lists for the type that's open, each paired with a slot
// in its row for the copy button. GraphiQL renders the rows, so they're found
// in the DOM by the field name link.
function findFieldCopyTargets(
  panel: HTMLElement,
  fields: Record<string, AnyField>,
) {
  const targets: FieldCopyTarget[] = [];

  for (const item of panel.querySelectorAll<HTMLElement>(
    '.graphiql-doc-explorer-content .graphiql-doc-explorer-item',
  )) {
    const name = item.querySelector(
      ':scope > div > .graphiql-doc-explorer-field-name',
    )?.textContent;
    const field = name ? fields[name] : undefined;

    if (!field) {
      continue;
    }

    let slot = item.querySelector<HTMLElement>(`:scope > .${COPY_SLOT_CLASS}`);

    if (!slot) {
      slot = document.createElement('div');
      slot.className = COPY_SLOT_CLASS;
      item.append(slot);
    }

    targets.push({ slot, field });
  }

  return targets;
}

const sameTargets = (a: FieldCopyTarget[], b: FieldCopyTarget[]) =>
  a.length === b.length &&
  a.every(
    (target, index) =>
      target.slot === b[index].slot && target.field === b[index].field,
  );

// The open page's header, under the search: a breadcrumb of the pages above
// it (each one goes back there), the name with a tag saying what it is, New
// query for a table, and the description. GraphiQL's own back link, title
// and description are hidden.
function Crumbs({
  items,
  ancestors,
  onSelect,
}: {
  items: (ExplorerNavStackItem | null)[];
  ancestors: ExplorerNavStackItem[];
  onSelect?: (index: number) => void;
}) {
  return (
    <>
      {items.map((item, position) => {
        const index = item ? ancestors.indexOf(item) : -1;

        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: positions are stable here
          <li key={position} className="flex shrink-0 items-center gap-1">
            {position > 0 && (
              <ChevronRight aria-hidden="true" className="size-3.5" />
            )}
            {item ? (
              <button
                type="button"
                tabIndex={onSelect ? undefined : -1}
                onClick={() => onSelect?.(index)}
                className="rounded-sm hover:text-foreground hover:underline"
              >
                {index === 0 ? 'Docs' : item.name}
              </button>
            ) : (
              <span aria-hidden="true">…</span>
            )}
          </li>
        );
      })}
    </>
  );
}

// The open page's header, under the search: a breadcrumb of the pages above
// it (each one goes back there), the name with a tag saying what it is, New
// query for a table, and the description. GraphiQL's own back link, title
// and description are hidden.
function DocsHeader({ newQueryButton }: { newQueryButton: ReactNode }) {
  const explorer = useExplorerContext({ nonNull: true });
  const { schema } = useSchemaContext({ nonNull: true });
  const stack = explorer.explorerNavStack;
  const current = stack.at(-1);
  const ancestors = stack.slice(0, -1);
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLOListElement>(null);
  const [fits, setFits] = useState(true);

  // The whole path shows while it fits on one line. Only a narrow panel
  // shortens it to the start, "…", and the last two pages. A hidden copy
  // of the full path is measured, so it grows back when there's room.
  useEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;

    if (!nav || !measure) {
      return undefined;
    }

    const check = () => setFits(measure.scrollWidth <= nav.clientWidth);

    check();

    const observer = new ResizeObserver(check);
    observer.observe(nav);

    return () => observer.disconnect();
  });

  if (!schema || !current || stack.length === 1) {
    return null;
  }

  const shown =
    fits || ancestors.length <= 3
      ? ancestors
      : [ancestors[0], null, ...ancestors.slice(-2)];
  const description =
    current.def && 'description' in current.def
      ? current.def.description
      : null;

  function goBackTo(index: number) {
    for (let step = index; step < stack.length - 1; step += 1) {
      explorer.pop();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <nav
        ref={navRef}
        aria-label="Docs breadcrumb"
        className="relative overflow-hidden"
      >
        <ol className="flex items-center gap-1 whitespace-nowrap text-muted-foreground text-sm">
          <Crumbs items={shown} ancestors={ancestors} onSelect={goBackTo} />
        </ol>
        <ol
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute top-0 left-0 flex w-max items-center gap-1 whitespace-nowrap text-sm"
        >
          <Crumbs items={ancestors} ancestors={ancestors} />
        </ol>
      </nav>

      <div className="flex items-center gap-3">
        <h2 className="min-w-0 truncate font-semibold text-foreground text-lg">
          {current.name}
        </h2>
        <span className="shrink-0 rounded-md border px-1.5 text-muted-foreground text-xs leading-5">
          {getDocsKind(current.def, schema)}
        </span>
        <span className="ml-auto shrink-0">{newQueryButton}</span>
      </div>

      {description && (
        <p className="text-muted-foreground text-sm">{description}</p>
      )}
    </div>
  );
}

// GraphiQL's docs, with our grouped type list on the start page. Every field
// of a type gets a copy button for a piece that can be pasted into a query,
// and a table gets a New query button.
function DocsPanel() {
  const explorer = useExplorerContext({ nonNull: true });
  const { schema } = useSchemaContext({ nonNull: true });
  const editorContext = useEditorContext({ nonNull: true });
  const executionContext = useExecutionContext({ nonNull: true });
  const panelRef = useRef<HTMLDivElement>(null);
  const [copyTargets, setCopyTargets] = useState<FieldCopyTarget[]>([]);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  const { explorerNavStack } = explorer;
  const isStartPage = explorerNavStack.length === 1;
  const current = explorerNavStack.at(-1)?.def;
  const openType =
    current && (isObjectType(current) || isInterfaceType(current))
      ? current
      : null;
  const tableQuery =
    schema && openType && `${openType.name}_aggregate` in schema.getTypeMap()
      ? buildTableQuery(schema, openType)
      : null;

  // GraphiQL's docs search only says "⌘ K", which is also the dashboard's
  // command palette shortcut. It has no prop for it and rebuilds the field
  // whenever you open a type, so the placeholder is set again each time. The
  // copy buttons and the New query slot follow the rows the same way.
  useEffect(() => {
    const panel = panelRef.current;

    if (!panel) {
      return undefined;
    }

    const fields = openType ? openType.getFields() : {};

    const sync = () => {
      const input = panel.querySelector<HTMLInputElement>(
        '.graphiql-doc-explorer-search [role="combobox"]',
      );

      if (input && input.placeholder !== 'Search the schema') {
        input.placeholder = 'Search the schema';
      }

      // Section titles with a list get its count, like "Fields 6". A
      // single type (the Type section) has none.
      for (const title of panel.querySelectorAll<HTMLElement>(
        '.graphiql-doc-explorer-content .graphiql-doc-explorer-section-title',
      )) {
        const count =
          title.nextElementSibling?.querySelectorAll(':scope > div').length ??
          0;

        if (count === 0) {
          delete title.dataset.count;
        } else if (title.dataset.count !== String(count)) {
          title.dataset.count = String(count);
        }
      }

      const next = findFieldCopyTargets(panel, fields);
      setCopyTargets((previous) =>
        sameTargets(previous, next) ? previous : next,
      );

      const header = panel.querySelector<HTMLElement>(
        '.graphiql-doc-explorer-header-content',
      );
      let slot = header?.querySelector<HTMLElement>(
        ':scope > .playground-header-slot',
      );

      if (header && !slot) {
        slot = document.createElement('div');
        slot.className = 'playground-header-slot';
        header.append(slot);
      }

      setHeaderSlot(slot ?? null);
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(panel, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [openType]);

  return (
    <div ref={panelRef} className={cn(isStartPage && 'playground-docs-start')}>
      <DocExplorer />
      {isStartPage && <SchemaTypeGroups />}

      {headerSlot &&
        createPortal(
          <DocsHeader
            newQueryButton={
              tableQuery && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="xs"
                      className="gap-1.5 px-2.5"
                      onClick={() => {
                        if (
                          !openQueryInTab(
                            editorContext,
                            executionContext,
                            tableQuery,
                          )
                        ) {
                          triggerToast('This query is already open');
                        }
                      }}
                    >
                      <Plus className="size-3.5" />
                      New query
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Opens a ready to run query for this table in a new tab
                  </TooltipContent>
                </Tooltip>
              )
            }
          />,
          headerSlot,
        )}

      {copyTargets.map(({ slot, field }) =>
        createPortal(
          <CopyToClipboardButton
            textToCopy={buildFieldSnippet(field)}
            title={field.name}
            className="h-7 w-7"
          />,
          slot,
          field.name,
        ),
      )}
    </div>
  );
}

/**
 * History and Docs, shown over the response while their tab is open. Both
 * stay mounted, so switching back keeps where you were.
 */
export function PlaygroundPanels({ tab }: { tab: PlaygroundPanelTab }) {
  return (
    <>
      <div
        role="tabpanel"
        className={cn(
          'absolute inset-x-0 top-12 bottom-0 z-10 overflow-y-auto bg-muted p-4',
          tab !== 'history' && 'hidden',
        )}
      >
        <QueryHistory />
      </div>
      <div
        role="tabpanel"
        className={cn(
          'playground-docs absolute inset-x-0 top-12 bottom-0 z-10 overflow-y-auto bg-muted p-4',
          tab !== 'docs' && 'hidden',
        )}
      >
        <DocsPanel />
      </div>
    </>
  );
}
