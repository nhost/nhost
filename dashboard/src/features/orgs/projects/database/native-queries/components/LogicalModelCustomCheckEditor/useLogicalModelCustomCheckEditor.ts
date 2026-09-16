import { createContext, useContext } from 'react';
import type { LogicalModelFieldResolution } from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';

export interface LogicalModelCustomCheckEditorValue {
  fields: LogicalModelFieldResolution;
  pathPrefix: readonly string[];
}

export const LogicalModelCustomCheckEditorContext =
  createContext<LogicalModelCustomCheckEditorValue>({
    fields: { descriptors: [], issues: [] },
    pathPrefix: [],
  });

export default function useLogicalModelCustomCheckEditor() {
  const context = useContext(LogicalModelCustomCheckEditorContext);

  return context;
}
