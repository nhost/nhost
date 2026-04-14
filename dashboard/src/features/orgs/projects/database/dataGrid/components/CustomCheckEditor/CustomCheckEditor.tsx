import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import AddNodeButton from './AddNodeButton';
import GroupNodeRenderer from './GroupNodeRenderer';
import { CustomCheckEditorContext } from './useCustomCheckEditor';

export interface CustomCheckEditorProps {
  disabled?: boolean;
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

export default function CustomCheckEditor({
  disabled,
  schema,
  table,
  name,
  maxDepth,
}: CustomCheckEditorProps) {
  const { setValue } = useFormContext();
  const filterValue = useWatch({ name });

  const contextValue = useMemo(
    () => ({
      disabled: !!disabled,
      schema,
      table,
    }),
    [disabled, schema, table],
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
    setValue(name, {
      type: 'group',
      operator: '_implicit',
      children: [],
      id: uuidv4(),
    });
  }

  return (
    <CustomCheckEditorContext.Provider value={contextValue}>
      <div className="w-full overflow-x-auto p-0.5 text-primary-text">
        {isEmpty ? (
          <AddNodeButton
            onSelect={handleAddNodeSelect}
            disabled={disabled}
            fullWidth
          />
        ) : (
          <GroupNodeRenderer
            name={name}
            maxDepth={maxDepth}
            onRemove={handleRootRemove}
          />
        )}
      </div>
    </CustomCheckEditorContext.Provider>
  );
}
