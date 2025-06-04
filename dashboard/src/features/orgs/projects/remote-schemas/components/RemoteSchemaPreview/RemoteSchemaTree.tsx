import { GraphQLSchema } from 'graphql';
import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ControlledTreeEnvironment, Tree } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import {
  AllowedRootFields,
  ComplexTreeData,
  HasuraRsFields,
  RelationshipFields,
} from './types';
import { buildComplexTreeData } from './utils';

export interface RemoteSchemaTreeProps {
  /**
   * GraphQL schema for setting new permissions.
   */
  schema: GraphQLSchema;
  relationshipFields: RelationshipFields[];
  selectedOperation?: string;
  rootFields: AllowedRootFields;
  setRelationshipFields: React.Dispatch<
    React.SetStateAction<RelationshipFields[]>
  >;
  fields: HasuraRsFields;
  showOnlySelectable?: boolean;
  checkable?: boolean;
  className?: string;
}

export interface RemoteSchemaTreeRef {
  findItemPath: (searchTerm: string) => Promise<string[] | null>;
  expandToItem: (path: string[]) => Promise<void>;
  focusItem: (itemId: string) => void;
  selectItems: (itemIds: string[]) => void;
  focusTree: () => void;
}

export const RemoteSchemaTree = forwardRef<
  RemoteSchemaTreeRef,
  RemoteSchemaTreeProps
>(
  (
    {
      schema,
      relationshipFields,
      rootFields,
      selectedOperation,
      setRelationshipFields,
      fields,
      showOnlySelectable = false,
      checkable = true,
      className,
    },
    ref,
  ) => {
    const treeRef = useRef<any>(null);
    const environmentRef = useRef<any>(null);

    const treeData: ComplexTreeData = useMemo(() => {
      return buildComplexTreeData({
        schema,
        relationshipFields,
        rootFields,
        fields,
        showOnlySelectable,
      });
    }, [
      schema,
      relationshipFields,
      rootFields,
      fields,
      selectedOperation,
      showOnlySelectable,
    ]);

    const [focusedItem, setFocusedItem] = useState<string>();
    const [expandedItems, setExpandedItems] = useState<string[]>(['root']);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    // Function to search through the tree data structure
    const findItemPath = async (
      searchTerm: string,
      searchRoot = 'root',
    ): Promise<string[] | null> => {
      const searchInItem = (
        itemId: string,
        currentPath: string[],
      ): string[] | null => {
        const item = treeData[itemId];
        if (!item) return null;

        const itemTitle =
          typeof item.data === 'string' ? item.data : String(item.data);

        // Check if current item matches the search term (case-insensitive)
        if (itemTitle.toLowerCase().includes(searchTerm.toLowerCase())) {
          return [...currentPath, itemId];
        }

        // Search in children
        if (item.children) {
          for (const childId of item.children) {
            const result = searchInItem(childId, [...currentPath, itemId]);
            if (result) return result;
          }
        }

        return null;
      };

      return searchInItem(searchRoot, []);
    };

    // Function to find all matching items (for potential future use)
    const findAllItemPaths = async (
      searchTerm: string,
      searchRoot = 'root',
    ): Promise<string[][]> => {
      const results: string[][] = [];

      const searchInItem = (itemId: string, currentPath: string[]): void => {
        const item = treeData[itemId];
        if (!item) return;

        const itemTitle =
          typeof item.data === 'string' ? item.data : String(item.data);

        // Check if current item matches the search term
        if (itemTitle.toLowerCase().includes(searchTerm.toLowerCase())) {
          results.push([...currentPath, itemId]);
        }

        // Search in children
        if (item.children) {
          for (const childId of item.children) {
            searchInItem(childId, [...currentPath, itemId]);
          }
        }
      };

      searchInItem(searchRoot, []);
      return results;
    };

    // Function to expand tree to show a specific item
    const expandToItem = async (path: string[]): Promise<void> => {
      if (treeRef.current && path.length > 0) {
        // Expand all parent items first
        const parentsToExpand = path.slice(0, -1);
        setExpandedItems((prev) => [...new Set([...prev, ...parentsToExpand])]);

        // Use the tree ref to expand the path
        await treeRef.current.expandSubsequently(path);
      }
    };

    // Expose methods through ref
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
      [treeData, findItemPath],
    );

    const getItemTitle = (item: any) => {
      if (typeof item.data === 'string') {
        return item.data;
      }
      return String(item.data);
    };

    return (
      <div className={className}>
        <ControlledTreeEnvironment
          ref={environmentRef}
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
  },
);

RemoteSchemaTree.displayName = 'RemoteSchemaTree';
