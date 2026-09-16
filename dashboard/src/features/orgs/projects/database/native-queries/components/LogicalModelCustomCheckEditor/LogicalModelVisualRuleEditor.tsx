import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { CustomCheckEditorContext } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import type { GroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import type { LogicalModelFieldResolution } from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';
import LogicalModelAddNodeButton from './LogicalModelAddNodeButton';
import LogicalModelGroupNodeRenderer from './LogicalModelGroupNodeRenderer';
import { LogicalModelCustomCheckEditorContext } from './useLogicalModelCustomCheckEditor';

interface LogicalModelVisualRuleEditorProps {
  name: string;
  fields: LogicalModelFieldResolution;
}

function emptyGroup(): GroupNode {
  return {
    type: 'group',
    id: uuidv4(),
    operator: '_implicit',
    children: [],
  };
}

function isEmptyFilter(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return true;
  }
  const group = value as Partial<GroupNode>;
  return (
    group.type === 'group' &&
    group.operator === '_implicit' &&
    Array.isArray(group.children) &&
    group.children.length === 0
  );
}

export default function LogicalModelVisualRuleEditor({
  name,
  fields,
}: LogicalModelVisualRuleEditorProps) {
  const { setValue, resetField } = useFormContext();
  const filter = useWatch({ name }) as GroupNode | undefined;
  const contextValue = useMemo(() => ({ fields, pathPrefix: [] }), [fields]);

  function handleRootRemove() {
    resetField(name, { defaultValue: emptyGroup() });
  }

  return (
    <CustomCheckEditorContext.Provider value={{ schema: '', table: '' }}>
      <LogicalModelCustomCheckEditorContext.Provider value={contextValue}>
        {isEmptyFilter(filter) ? (
          <LogicalModelAddNodeButton
            onSelectNode={(node) => {
              setValue(
                name,
                node.type === 'group'
                  ? node
                  : { ...emptyGroup(), children: [node] },
                { shouldDirty: true },
              );
            }}
            fullWidth
          />
        ) : (
          <LogicalModelGroupNodeRenderer
            name={name}
            onRemove={handleRootRemove}
          />
        )}
      </LogicalModelCustomCheckEditorContext.Provider>
    </CustomCheckEditorContext.Provider>
  );
}
