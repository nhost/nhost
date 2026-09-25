import type { ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  type CustomCheckEditorMode,
  CustomCheckModeProvider,
  useCustomCheckMode,
} from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/CustomCheckModeProvider';
import FilterErrorsSummary from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/FilterErrorsSummary';
import JsonRuleEditor from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/JsonRuleEditor';
import type { LogicalModelFieldDescriptor } from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';
import { cn } from '@/lib/utils';
import LogicalModelVisualRuleEditor from './LogicalModelVisualRuleEditor';

export interface LogicalModelCustomCheckEditorProps {
  name: string;
  fields: LogicalModelFieldDescriptor[];
}

export function LogicalModelCustomCheckEditor({
  name,
  fields,
}: LogicalModelCustomCheckEditorProps) {
  const { mode } = useCustomCheckMode();

  return (
    <div className="w-full overflow-x-auto p-0.5 text-primary-text">
      <FilterErrorsSummary name={name} />
      {mode === 'json' ? (
        <JsonRuleEditor name={name} />
      ) : (
        <LogicalModelVisualRuleEditor name={name} fields={fields} />
      )}
    </div>
  );
}

export function LogicalModelCustomCheckModeToggle() {
  const { mode, setMode } = useCustomCheckMode();
  const options: Array<{
    value: CustomCheckEditorMode;
    label: string;
  }> = [
    { value: 'builder', label: 'Visual' },
    { value: 'json', label: 'JSON' },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">Edit as:</span>
      <fieldset
        aria-label="Editor mode"
        className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5"
      >
        {options.map(({ value, label }) => {
          const isActive = mode === value;
          return (
            <Button
              key={value}
              type="button"
              aria-pressed={isActive}
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2.5 text-xs',
                isActive
                  ? 'bg-background shadow-sm hover:bg-background'
                  : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
              )}
              onClick={() => setMode(value)}
            >
              {label}
            </Button>
          );
        })}
      </fieldset>
    </div>
  );
}

export interface LogicalModelCustomCheckEditorProviderProps {
  children: ReactNode;
  defaultMode?: CustomCheckEditorMode;
}

export function LogicalModelCustomCheckEditorProvider({
  children,
  defaultMode = 'builder',
}: LogicalModelCustomCheckEditorProviderProps) {
  return (
    <CustomCheckModeProvider defaultMode={defaultMode}>
      {children}
    </CustomCheckModeProvider>
  );
}
