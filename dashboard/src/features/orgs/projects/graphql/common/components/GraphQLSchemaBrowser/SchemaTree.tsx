import { useEffect, useId, useRef } from 'react';
import { ControlledTreeEnvironment, Tree } from 'react-complex-tree';
import { cn } from '@/lib/utils';
import { useThemePreference } from '@/providers/Theme';
import 'react-complex-tree/lib/style-modern.css';
import SchemaTreeItemTitle from './SchemaTreeItemTitle';
import { getNodeLabel, ROOT_ITEM_ID } from './schemaTreeItems';
import type { SchemaTreeItems } from './types';

export interface SchemaTreeProps {
  items: SchemaTreeItems;
  expandedItems: string[];
  focusedItem?: string;
  selectedItems: string[];
  /**
   * Scrolls the focused item into view again whenever it changes, even when
   * the focused item stays the same.
   */
  scrollKey: number;
  highlightTerm: string;
  onExpand: (itemId: string) => void;
  onCollapse: (itemId: string) => void;
  onFocus: (itemId: string) => void;
  onSelect: (itemIds: string[]) => void;
}

export default function SchemaTree({
  items,
  expandedItems,
  focusedItem,
  selectedItems,
  scrollKey,
  highlightTerm,
  onExpand,
  onCollapse,
  onFocus,
  onSelect,
}: SchemaTreeProps) {
  const treeId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useThemePreference();

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on `scrollKey` so revealing the focused item again scrolls to it
  useEffect(() => {
    if (!focusedItem) {
      return;
    }

    // The items' scroll margin keeps an item scrolled up into view below a
    // sticky header instead of under it.
    containerRef.current
      ?.querySelector(`[data-rct-item-id="${focusedItem}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [focusedItem, scrollKey]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-background text-foreground [&_[data-rct-item-id]]:scroll-mt-[calc(var(--sticky-header-height,0px)+0.5rem)]',
        { 'rct-dark': resolvedTheme === 'dark' },
      )}
    >
      <ControlledTreeEnvironment
        items={items}
        getItemTitle={(item) => getNodeLabel(item.data)}
        renderItemTitle={({ item }) => (
          <SchemaTreeItemTitle node={item.data} highlightTerm={highlightTerm} />
        )}
        viewState={{ [treeId]: { focusedItem, expandedItems, selectedItems } }}
        onExpandItem={(item) => onExpand(String(item.index))}
        onCollapseItem={(item) => onCollapse(String(item.index))}
        onFocusItem={(item) => onFocus(String(item.index))}
        onSelectItems={(itemIds) => onSelect(itemIds.map(String))}
        canSearch={false}
      >
        <Tree treeId={treeId} rootItem={ROOT_ITEM_ID} treeLabel="Schema" />
      </ControlledTreeEnvironment>
    </div>
  );
}
