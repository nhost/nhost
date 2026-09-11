import { createContext, type ReactNode, useContext } from 'react';
import type { LogicalModelFieldResolution } from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';

const LogicalFieldsContext = createContext<LogicalModelFieldResolution | null>(
  null,
);

export interface LogicalModelEditorDialectProviderProps {
  children: ReactNode;
  fields: LogicalModelFieldResolution;
}

export function LogicalModelEditorDialectProvider({
  children,
  fields,
}: LogicalModelEditorDialectProviderProps) {
  return (
    <LogicalFieldsContext.Provider value={fields}>
      {children}
    </LogicalFieldsContext.Provider>
  );
}

export function useLogicalFields(): LogicalModelFieldResolution {
  const fields = useContext(LogicalFieldsContext);
  if (!fields) {
    throw new Error('Logical editor fields are unavailable.');
  }
  return fields;
}
