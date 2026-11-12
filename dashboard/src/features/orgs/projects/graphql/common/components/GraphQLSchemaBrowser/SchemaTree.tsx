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
  highlightTerm,
  onExpand,
  onCollapse,
  onFocus,
  onSelect,
}: SchemaTreeProps) {
  const treeId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useThemePreference();

  useEffect(() => {
    if (!focusedItem) {
      return;
    }

    containerRef.current
      ?.querySelector(`[data-rct-item-id="${focusedItem}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [focusedItem]);

  return (
    <div
      ref={containerRef}
      className={cn('bg-background text-foreground', {
        'rct-dark': resolvedTheme === 'dark',
      })}
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
