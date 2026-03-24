import { v4 as uuidv4 } from 'uuid';

import type { GroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { isGroupNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';

import type { PermissionPreset } from './types';

export default function applyPreset(
  currentFilter: GroupNode | null,
  preset: PermissionPreset,
): GroupNode {
  const node = preset.createNode();

  const hasChildren =
    currentFilter &&
    isGroupNode(currentFilter) &&
    currentFilter.children.length > 0;

  if (!hasChildren) {
    return {
      type: 'group',
      id: currentFilter?.id ?? uuidv4(),
      operator: '_or',
      children: [node],
    };
  }

  if (currentFilter.operator === '_or') {
    return {
      ...currentFilter,
      children: [...currentFilter.children, node],
    };
  }

  return {
    type: 'group',
    id: currentFilter.id,
    operator: '_or',
    children: [currentFilter, node],
  };
}
