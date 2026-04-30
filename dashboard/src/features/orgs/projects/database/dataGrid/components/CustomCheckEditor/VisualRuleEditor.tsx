import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import AddNodeButton from './AddNodeButton';
import GroupNodeRenderer from './GroupNodeRenderer';
import { CustomCheckEditorContext } from './useCustomCheckEditor';

export interface VisualRuleEditorProps {
  schema: string;
  table: string;
  name: string;
  maxDepth?: number;
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
}: VisualRuleEditorProps) {
  const { setValue, resetField } = useFormContext();
  const filterValue = useWatch({ name });

  const contextValue = useMemo(
    () => ({
      schema,
      table,
    }),
    [schema, table],
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

  return (
    <CustomCheckEditorContext.Provider value={contextValue}>
      {isEmpty ? (
        <AddNodeButton onSelect={handleAddNodeSelect} fullWidth />
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
