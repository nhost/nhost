import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import type { ConditionFieldSelection } from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import useCustomCheckEditor from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';

export interface ConditionRowProps {
  name: string;
  onRemove?: VoidFunction;
}

export default function ConditionRow({ name, onRemove }: ConditionRowProps) {
  const { dialect } = useCustomCheckEditor();
  const [selectedFieldPath, setSelectedFieldPath] = useState('');
  const [selectedFieldType, setSelectedFieldType] = useState('');
  const { ConditionField, ConditionOperator, ConditionValue } = dialect;

  function handleFieldSelectionChange({
    fieldPath,
    fieldType,
  }: ConditionFieldSelection) {
    setSelectedFieldPath(fieldPath);
    setSelectedFieldType(fieldType);
  }

  return (
    <div className="mt-4 flex flex-col gap-1 space-y-1 overflow-x-hidden rounded-md p-1 transition-colors focus-within:bg-accent/50 hover:bg-accent/50 xl:grid xl:grid-flow-row xl:grid-cols-[320px_160px_minmax(100px,_1fr)_40px] xl:space-y-0 xl:overflow-x-visible">
      <ConditionField
        name={name}
        onFieldSelectionChange={handleFieldSelectionChange}
      />
      <ConditionOperator name={name} selectedFieldType={selectedFieldType} />
      <ConditionValue
        selectedFieldPath={selectedFieldPath}
        name={name}
        className="min-h-10"
      />

      <Button
        variant="ghost"
        size="icon"
        className="w-full text-destructive xl:w-auto"
        onClick={onRemove}
        aria-label="Delete condition"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
