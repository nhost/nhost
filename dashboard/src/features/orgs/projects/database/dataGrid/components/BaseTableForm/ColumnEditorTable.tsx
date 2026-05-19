import { Plus } from 'lucide-react';
import { useFieldArray, useFormState } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { Label } from '@/components/ui/v3/label';
import { ColumnEditorRow } from './ColumnEditorRow';

function ColumnErrorMessage() {
  const { errors } = useFormState({ name: 'columns' });

  if (typeof errors?.columns?.root?.message === 'string') {
    return (
      <p className="mt-2 font-medium text-destructive text-sm">
        {errors.columns.root.message}
      </p>
    );
  }

  return null;
}

export default function ColumnEditorTable() {
  const { fields, append, remove } = useFieldArray({ name: 'columns' });

  return (
    <>
      <div className="w-full max-[900px]:overflow-x-auto max-[900px]:pb-2">
        <div className="flex gap-2 pt-1 pb-2">
          <div className="w-52 flex-none">
            <Label asChild>
              <span>
                Name
                <span className="text-destructive">*</span>
              </span>
            </Label>
          </div>

          <div className="w-52 flex-none">
            <Label asChild>
              <span>
                Type
                <span className="text-destructive">*</span>
              </span>
            </Label>
          </div>

          <div className="w-52 flex-none">
            <Label asChild>
              <span>Default Value</span>
            </Label>
          </div>
          <div className="w-8 flex-none">
            <Label asChild className="hidden">
              <span>Comment</span>
            </Label>
          </div>

          <div className="w-13 flex-none text-center">
            <Label asChild className="truncate">
              <span>Nullable</span>
            </Label>
          </div>

          <div className="w-13 flex-none text-center">
            <Label asChild className="truncate">
              <span>Unique</span>
            </Label>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2">
          {fields.map((field, index) => (
            <ColumnEditorRow key={field.id} index={index} remove={remove} />
          ))}
        </div>

        <ColumnErrorMessage />
      </div>

      <div className="col-span-8 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 text-primary hover:text-primary"
          onClick={() =>
            append({
              name: '',
              type: null,
              defaultValue: null,
              isNullable: false,
              isUnique: false,
              isIdentity: false,
              comment: null,
            })
          }
        >
          <Plus className="h-4 w-4" />
          Add Column
        </Button>
      </div>
    </>
  );
}
