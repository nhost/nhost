import { useCustomCheckMode } from './CustomCheckModeProvider';
import FilterErrorsSummary from './FilterErrorsSummary';
import JsonRuleEditor from './JsonRuleEditor';
import type { CustomCheckEditorDialect } from './useCustomCheckEditor';
import VisualRuleEditor from './VisualRuleEditor';

export interface CustomCheckEditorProps {
  schema: string;
  table: string;
  name: string;
  maxDepth?: number;
  dialect?: CustomCheckEditorDialect;
}

export default function CustomCheckEditor({
  schema,
  table,
  name,
  maxDepth,
  dialect,
}: CustomCheckEditorProps) {
  const { mode } = useCustomCheckMode();

  return (
    <div className="w-full overflow-x-auto p-0.5 text-primary-text">
      <FilterErrorsSummary name={name} />
      {mode === 'json' ? (
        <JsonRuleEditor name={name} />
      ) : (
        <VisualRuleEditor
          schema={schema}
          table={table}
          name={name}
          maxDepth={maxDepth}
          dialect={dialect}
        />
      )}
    </div>
  );
}
