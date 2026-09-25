import { createContext, useContext } from 'react';
import type { LogicalModelFieldDescriptor } from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';

export interface LogicalModelCustomCheckEditorValue {
  fields: LogicalModelFieldDescriptor[];
}

export const LogicalModelCustomCheckEditorContext =
  createContext<LogicalModelCustomCheckEditorValue>({
    fields: [],
  });

export default function useLogicalModelCustomCheckEditor() {
  const context = useContext(LogicalModelCustomCheckEditorContext);

  return context;
}
