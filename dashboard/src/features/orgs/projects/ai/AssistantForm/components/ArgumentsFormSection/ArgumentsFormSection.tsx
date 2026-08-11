import { PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { type Path, useFieldArray, useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormSwitch } from '@/components/form/FormSwitch';
import { FormTextarea } from '@/components/form/FormTextarea';
import { Button } from '@/components/ui/v3/button';
import { SelectItem } from '@/components/ui/v3/select';
import type { AssistantFormValues } from '@/features/orgs/projects/ai/AssistantForm/AssistantForm';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';

const ARGUMENT_TYPES = [
  'string',
  'number',
  'integer',
  'object',
  'array',
  'boolean',
];

const argumentFieldClasses =
  '!border-input !bg-background dark:!bg-accent-background';

type AssistantFormPath = Path<AssistantFormValues>;

interface ArgumentsFormSectionProps {
  nestedField: 'graphql' | 'webhooks';
  nestIndex: number;
}

export default function ArgumentsFormSection({
  nestedField,
  nestIndex,
}: ArgumentsFormSectionProps) {
  const form = useFormContext<AssistantFormValues>();

  const { fields, append, remove } = useFieldArray({
    name: `${nestedField}.${nestIndex}.arguments`,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center space-x-2">
          <h4 className="font-semibold text-sm+">Arguments</h4>
          <InfoTooltip>Arguments</InfoTooltip>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Add argument"
          onClick={() => append({})}
        >
          <PlusIcon className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex flex-col space-y-4">
        {fields.map((field, index) => {
          const nameField =
            `${nestedField}.${nestIndex}.arguments.${index}.name` as AssistantFormPath;
          const descriptionField =
            `${nestedField}.${nestIndex}.arguments.${index}.description` as AssistantFormPath;
          const typeField =
            `${nestedField}.${nestIndex}.arguments.${index}.type` as AssistantFormPath;
          const requiredField =
            `${nestedField}.${nestIndex}.arguments.${index}.required` as AssistantFormPath;

          return (
            <div key={field.id} className="rounded-md border bg-muted p-3">
              <div className="grid gap-2">
                <FormInput
                  control={form.control}
                  name={nameField}
                  placeholder="Name"
                  autoComplete="off"
                  className={argumentFieldClasses}
                />

                <FormTextarea
                  control={form.control}
                  name={descriptionField}
                  label={<span className="sr-only">Description</span>}
                  placeholder="Description"
                  autoComplete="off"
                  className={`${argumentFieldClasses} min-h-10 resize-y`}
                />

                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                  <FormSelect
                    control={form.control}
                    name={typeField}
                    placeholder="Select argument type"
                    className="border-input bg-background dark:bg-accent-background"
                    containerClassName="space-y-0"
                    contentClassName="z-[10000] w-[270px] min-w-0"
                  >
                    {ARGUMENT_TYPES.map((argumentType) => (
                      <SelectItem key={argumentType} value={argumentType}>
                        {argumentType}
                      </SelectItem>
                    ))}
                  </FormSelect>

                  <FormSwitch
                    control={form.control}
                    name={requiredField}
                    label="Required"
                    className="border-muted-foreground/60 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/35 dark:data-[state=checked]:border-primary dark:data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-slate-500"
                    containerClassName="flex h-10 flex-row-reverse items-center gap-2 space-y-0 px-1"
                    labelClassName="font-normal text-muted-foreground"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 text-destructive hover:text-destructive"
                    aria-label="Remove argument"
                    onClick={() => remove(index)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
