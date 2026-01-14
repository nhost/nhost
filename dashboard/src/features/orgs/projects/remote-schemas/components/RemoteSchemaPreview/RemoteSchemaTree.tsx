import { cn } from '@/lib/utils';
import { useTheme } from '@mui/material';
import type { GraphQLSchema } from 'graphql';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ControlledTreeEnvironment,
  Tree,
  type TreeRef,
} from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import getText from './getText';
import type { ComplexTreeData } from './types';
import { buildComplexTreeData, highlightNode } from './utils';

export interface RemoteSchemaTreeProps {
  /**
   * GraphQL schema for setting new permissions.
   */
  schema: GraphQLSchema;
  className?: string;
  highlightTerm?: string;
}

export interface RemoteSchemaTreeRef {
  findAllItemPaths: (searchTerm: string) => string[][];
  expandToItem: (path: string[]) => Promise<void>;
  focusItem: (itemId: string) => void;
  selectItems: (itemIds: string[]) => void;
  focusTree: () => void;
}

export const RemoteSchemaTree = forwardRef<
  RemoteSchemaTreeRef,
  RemoteSchemaTreeProps
>(({ schema, className, highlightTerm }, ref) => {
  const treeRef = useRef<TreeRef<string | React.ReactNode>>(null);

  const theme = useTheme();

  const treeData: ComplexTreeData = useMemo(
    () =>
      buildComplexTreeData({
        schema,
      }),
    [schema],
  );

  const [focusedItem, setFocusedItem] = useState<string>();
  const [expandedItems, setExpandedItems] = useState<string[]>(['root']);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const findAllItemPaths = useCallback(
    (searchTerm: string, searchRoot = 'root'): string[][] => {
      const lowerSearchTerm = searchTerm.toLowerCase();

      const collectInItem = (
        itemId: string,
        currentPath: string[],
        acc: string[][],
      ): void => {
        const item = treeData[itemId];
        if (!item) {
          return;
        }

        const searchableText = getText(item.data);
        if (searchableText.toLowerCase().includes(lowerSearchTerm)) {
          acc.push([...currentPath, itemId]);
        }

        for (const childId of item.children ?? []) {
          collectInItem(childId, [...currentPath, itemId], acc);
        }
      };

      const results: string[][] = [];
      collectInItem(searchRoot, [], results);
      return results;
    },
    [treeData],
  );

  useImperativeHandle(
    ref,
    () => ({
      findAllItemPaths,
      expandToItem: async (path: string[]): Promise<void> => {
        if (treeRef.current && path.length > 0) {
          const parentsToExpand = path.slice(0, -1);
          setExpandedItems((prev) => [
            ...new Set([...prev, ...parentsToExpand]),
          ]);

          await treeRef.current.expandSubsequently(path);
        }
      },
      focusItem: (itemId: string) => {
        setFocusedItem(itemId);
        treeRef.current?.focusItem(itemId);
      },
      selectItems: (itemIds: string[]) => {
        setSelectedItems(itemIds);
        treeRef.current?.selectItems(itemIds);
      },
      focusTree: () => {
        treeRef.current?.focusTree();
      },
    }),
    [findAllItemPaths],
  );

  // biome-ignore lint/suspicious/noExplicitAny: TODO
  const getItemTitle = (item: any) => {
    if (React.isValidElement(item.data)) {
      return item.data as string;
    }

    if (typeof item.data === 'string') {
      return item.data;
    }
    return String(item.data);
  };

  return (
    <div
      className={cn(className, { 'rct-dark': theme.palette.mode === 'dark' })}
      style={
        theme.palette.mode === 'dark'
          ? {
              backgroundColor: '#171d26',
              color: '#e3e3e3',
            }
          : undefined
      }
    >
      <ControlledTreeEnvironment
        items={treeData}
        getItemTitle={getItemTitle}
        renderItemTitle={({ title }) => (
          <span>{highlightNode(title, highlightTerm)}</span>
        )}
        viewState={{
          'schema-tree': {
            focusedItem,
            expandedItems,
            selectedItems,
          },
        }}
        onFocusItem={(item) => setFocusedItem(String(item.index))}
        onExpandItem={(item) =>
          setExpandedItems((prev) => [...prev, String(item.index)])
        }
        onCollapseItem={(item) =>
          setExpandedItems((prev) =>
            prev.filter((id) => id !== String(item.index)),
          )
        }
        onSelectItems={(items) => setSelectedItems(items.map(String))}
        canSearch={false}
      >
        <Tree
          ref={treeRef}
          treeId="schema-tree"
          rootItem="root"
          treeLabel="Remote Schema Tree"
        />
      </ControlledTreeEnvironment>
    </div>
  );
});

RemoteSchemaTree.displayName = 'RemoteSchemaTree';
