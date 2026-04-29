import { Plus, Trash, Upload, X } from 'lucide-react';
import { useRef } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';

export interface MultipartEditorProps {
  name: string;
}

export default function MultipartEditor({ name }: MultipartEditorProps) {
  const { register, setValue, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({ name });
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  return (
    <div className="space-y-2">
      {fields.map((field, index) => {
        const file = watch(`${name}.${index}.file`) as File | null;

        return (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              placeholder="Parameter name"
              {...register(`${name}.${index}.key`)}
              className="h-8 font-mono text-sm"
            />
            <Input
              placeholder="Value"
              {...(file
                ? { value: file.name, disabled: true }
                : register(`${name}.${index}.value`))}
              className="h-8 font-mono text-sm"
            />
            <input
              ref={(el) => {
                fileInputRefs.current[index] = el;
              }}
              type="file"
              aria-label="File upload"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null;
                setValue(`${name}.${index}.file`, selected);
                if (selected) {
                  setValue(`${name}.${index}.value`, selected.name);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                if (file) {
                  setValue(`${name}.${index}.file`, null);
                  setValue(`${name}.${index}.value`, '');
                } else {
                  fileInputRefs.current[index]?.click();
                }
              }}
              title={file ? 'Remove file' : 'Choose file'}
            >
              {file ? (
                <X className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>
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
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => append({ key: '', value: '', file: null })}
      >
        <Plus className="h-3 w-3" />
        Add row
      </Button>
    </div>
  );
}
