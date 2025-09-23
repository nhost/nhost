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
import type { ComplexTreeData } from './types';
import { buildComplexTreeData } from './utils';

export interface RemoteSchemaTreeProps {
  /**
   * GraphQL schema for setting new permissions.
   */
  schema: GraphQLSchema;
  className?: string;
}

export interface RemoteSchemaTreeRef {
  findItemPath: (searchTerm: string) => string[] | null;
  expandToItem: (path: string[]) => Promise<void>;
  focusItem: (itemId: string) => void;
  selectItems: (itemIds: string[]) => void;
  focusTree: () => void;
}

export const RemoteSchemaTree = forwardRef<
  RemoteSchemaTreeRef,
  RemoteSchemaTreeProps
>(({ schema, className }, ref) => {
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

  const findItemPath = useCallback(
    (searchTerm: string, searchRoot = 'root'): string[] | null => {
      const lowerSearchTerm = searchTerm.toLowerCase();

      const getText = (data: any): string => {
        if (React.isValidElement<{ children?: React.ReactNode }>(data)) {
          const { children } = data.props;
          if (Array.isArray(children)) {
            return children.map(getText).join('');
          }
          return getText(children);
        }
        if (typeof data === 'string' || typeof data === 'number') {
          return String(data);
        }
        return String(data);
      };

      const searchInItem = (
        itemId: string,
        currentPath: string[],
      ): string[] | null => {
        const item = treeData[itemId];
        if (!item) {
          return null;
        }

        const searchableText = getText(item.data);
        if (searchableText.toLowerCase().includes(lowerSearchTerm)) {
          return [...currentPath, itemId];
        }

        let foundPath: string[] | null = null;
        // eslint-disable-next-line no-restricted-syntax
        for (const childId of item.children ?? []) {
          foundPath = searchInItem(childId, [...currentPath, itemId]);
          if (foundPath) {
            break;
          }
        }
        return foundPath;
      };

      return searchInItem(searchRoot, []);
    },
    [treeData],
  );

  const expandToItem = async (path: string[]): Promise<void> => {
    if (treeRef.current && path.length > 0) {
      const parentsToExpand = path.slice(0, -1);
      setExpandedItems((prev) => [...new Set([...prev, ...parentsToExpand])]);

      await treeRef.current.expandSubsequently(path);
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      findItemPath,
      expandToItem,
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
    [findItemPath],
  );

  const getItemTitle = (item: any) => {
    if (React.isValidElement(item.data)) {
      return item.data;
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
