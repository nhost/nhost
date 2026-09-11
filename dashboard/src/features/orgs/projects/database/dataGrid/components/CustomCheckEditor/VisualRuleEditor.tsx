import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import GroupNodeRenderer from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/GroupNodeRenderer';
import tableCustomCheckEditorDialect from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/tableCustomCheckEditorDialect';
import {
  CustomCheckEditorContext,
  type CustomCheckEditorDialect,
} from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';

export interface VisualRuleEditorProps {
  schema: string;
  table: string;
  name: string;
  maxDepth?: number;
  dialect?: CustomCheckEditorDialect;
}

function isEmptyFilter(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return true;
  }

  const obj = value as Record<string, unknown>;

  if (Object.keys(obj).length === 0) {
    return true;
  }

  if (
    obj.type === 'group' &&
    obj.operator === '_implicit' &&
    Array.isArray(obj.children) &&
    obj.children.length === 0
  ) {
    return true;
  }

  return false;
}

export default function VisualRuleEditor({
  schema,
  table,
  name,
  maxDepth,
  dialect = tableCustomCheckEditorDialect,
}: VisualRuleEditorProps) {
  const { setValue, resetField } = useFormContext();
  const filterValue = useWatch({ name });

  const contextValue = useMemo(
    () => ({
      schema,
      table,
      dialect,
    }),
    [schema, table, dialect],
  );

  const isEmpty = isEmptyFilter(filterValue);

  function handleAddNodeSelect(node: RuleNode) {
    if (node.type === 'group') {
      setValue(name, node);
    } else {
      setValue(name, {
        type: 'group',
        id: uuidv4(),
        operator: '_implicit',
        children: [node],
      });
    }
  }

  function handleRootRemove() {
    resetField(name, {
      defaultValue: {
        type: 'group',
        operator: '_implicit',
        children: [],
        id: uuidv4(),
      },
    });
  }

  const { AddNode } = dialect;

  return (
    <CustomCheckEditorContext.Provider value={contextValue}>
      {isEmpty ? (
        <AddNode onSelect={handleAddNodeSelect} fullWidth />
      ) : (
        <GroupNodeRenderer
          name={name}
          maxDepth={maxDepth}
          onRemove={handleRootRemove}
        />
      )}
    </CustomCheckEditorContext.Provider>
  );
}
