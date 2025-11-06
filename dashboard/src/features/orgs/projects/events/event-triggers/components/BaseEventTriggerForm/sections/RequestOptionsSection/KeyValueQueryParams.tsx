import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Button } from '@/components/ui/v3/button';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from '@/components/ui/v3/field';
import { Input } from '@/components/ui/v3/input';
import { type BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';

export default function KeyValueQueryParams() {
  const form = useFormContext<BaseEventTriggerFormValues>();

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'requestOptionsTransform.queryParams.queryParams',
  });

  return (
    <FieldSet>
      <div className="flex items-center justify-between">
        <FieldLegend
          variant="label"
          className="flex flex-row items-center gap-2 text-foreground"
        >
          Key Value Query Params{' '}
        </FieldLegend>
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
      <FieldGroup className="flex flex-col gap-4">
        {fields.length > 0 && (
          <div className="grid grid-flow-row grid-cols-9 text-sm+ text-foreground">
            <span className="col-span-3">Key</span>
            <div className="col-span-1" />
            <span className="col-span-4">Value</span>
          </div>
        )}
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid grid-flow-row grid-cols-9 items-center gap-2"
          >
            <Controller
              name={`requestOptionsTransform.queryParams.queryParams.${index}.key`}
              control={form.control}
              render={({ field: controllerField, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="col-span-3">
                  <Input
                    {...controllerField}
                    id={`requestOptionsTransform.queryParams.queryParams.${index}.key`}
                    aria-invalid={fieldState.invalid}
                    placeholder="Key"
                    className="text-foreground"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <span className="col-span-1 text-center text-foreground">:</span>
            <div className="col-span-4 flex items-center">
              <Controller
                name={`requestOptionsTransform.queryParams.queryParams.${index}.value`}
                control={form.control}
                render={({ field: controllerField, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-4"
                  >
                    <Input
                      {...controllerField}
                      id={`requestOptionsTransform.queryParams.queryParams.${index}.value`}
                      aria-invalid={fieldState.invalid}
                      placeholder="Value"
                      className="text-foreground"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="col-span-1 px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => remove(index)}
            >
              <TrashIcon className="size-4" />
            </Button>
          </div>
        ))}
      </FieldGroup>
    </FieldSet>
  );
}
