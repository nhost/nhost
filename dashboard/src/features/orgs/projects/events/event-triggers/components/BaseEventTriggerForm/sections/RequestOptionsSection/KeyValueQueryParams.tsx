import { useFieldArray, useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Button } from '@/components/ui/v3/button';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';

export default function KeyValueQueryParams() {
  const form = useFormContext<BaseEventTriggerFormValues>();

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'requestOptionsTransform.queryParams.queryParams',
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-foreground text-sm">
          Key Value Query Params{' '}
        </h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-4 text-primary hover:bg-muted hover:text-primary"
          onClick={() => append({ key: '', value: '' })}
        >
          <PlusIcon className="size-5" />
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        {fields.length > 0 && (
          <div className="grid grid-flow-row grid-cols-9 text-foreground text-sm+">
            <span className="col-span-3">Key</span>
            <div className="col-span-1" />
            <span className="col-span-4">Value</span>
          </div>
        )}
        {fields.map((fieldItem, index) => (
          <div
            key={fieldItem.id}
            className="grid grid-flow-row grid-cols-9 items-center gap-2"
          >
            <div className="col-span-3 self-start">
              <FormInput
                control={form.control}
                name={`requestOptionsTransform.queryParams.queryParams.${index}.key`}
                label=""
                placeholder="Key"
                className="text-foreground"
                autoComplete="off"
              />
            </div>
            <div className="col-span-1 flex h-10 items-center justify-center self-start pt-2">
              <span className="text-center text-foreground">:</span>
            </div>
            <div className="col-span-4 self-start">
              <FormInput
                control={form.control}
                name={`requestOptionsTransform.queryParams.queryParams.${index}.value`}
                label=""
                placeholder="Value"
                className="text-foreground"
                autoComplete="off"
              />
            </div>

            <div className="col-span-1 self-start pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(index)}
              >
                <TrashIcon className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
