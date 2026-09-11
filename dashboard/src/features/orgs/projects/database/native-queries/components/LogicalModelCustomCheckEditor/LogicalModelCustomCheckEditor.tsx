import type { ReactNode } from 'react';
import {
  CustomCheckEditor,
  type CustomCheckEditorMode,
  CustomCheckModeProvider,
} from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor';
import {
  LogicalModelEditorDialectProvider,
  logicalModelCustomCheckEditorDialect,
} from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditorDialect';
import type { LogicalModelFieldResolution } from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';

export interface LogicalModelCustomCheckEditorProps {
  name: string;
  fields: LogicalModelFieldResolution;
}

export function LogicalModelCustomCheckEditor({
  name,
  fields,
}: LogicalModelCustomCheckEditorProps) {
  return (
    <LogicalModelEditorDialectProvider fields={fields}>
      <CustomCheckEditor
        schema=""
        table=""
        name={name}
        dialect={logicalModelCustomCheckEditorDialect}
      />
    </LogicalModelEditorDialectProvider>
  );
}

export interface LogicalModelCustomCheckEditorProviderProps {
  children: ReactNode;
  mode: CustomCheckEditorMode;
  onModeChange?: (mode: CustomCheckEditorMode) => void;
}

export function LogicalModelCustomCheckEditorProvider({
  children,
  mode,
  onModeChange,
}: LogicalModelCustomCheckEditorProviderProps) {
  return (
    <CustomCheckModeProvider mode={mode} onModeChange={onModeChange}>
      {children}
    </CustomCheckModeProvider>
  );
}
