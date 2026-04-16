import { Plus, Trash } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';

export interface KeyValueEditorProps {
  name: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export default function KeyValueEditor({
  name,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: KeyValueEditorProps) {
  const { register } = useFormContext();
  const { fields, append, remove } = useFieldArray({ name });

  return (
    <div className="space-y-2">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input
            placeholder={keyPlaceholder}
            {...register(`${name}.${index}.key`)}
            className="h-8 font-mono text-sm"
          />
          <Input
            placeholder={valuePlaceholder}
            {...register(`${name}.${index}.value`)}
            className="h-8 max-w-md flex-1 font-mono text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => remove(index)}
          >
            <Trash className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => append({ key: '', value: '' })}
      >
        <Plus className="h-3 w-3" />
        Add row
      </Button>
    </div>
  );
}
