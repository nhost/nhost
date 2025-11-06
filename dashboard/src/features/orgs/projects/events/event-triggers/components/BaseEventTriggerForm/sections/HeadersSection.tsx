import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Button } from '@/components/ui/v3/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from '@/components/ui/v3/field';
import { Input } from '@/components/ui/v3/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { IconTooltip } from '@/features/orgs/projects/common/components/IconTooltip';
import {
  headerTypes,
  type BaseEventTriggerFormValues,
} from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { cn } from '@/lib/utils';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';

interface HeadersSectionProps {
  className?: string;
}

export default function HeadersSection({ className }: HeadersSectionProps) {
  const form = useFormContext<BaseEventTriggerFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'headers',
  });

  return (
    <FieldSet className={className}>
      <div className="flex items-center justify-between">
        <FieldLegend className="flex flex-row items-center gap-2 text-foreground">
          Additional Headers{' '}
          <FieldDescription>
            <IconTooltip>
              Custom headers to be sent with the webhook request.
            </IconTooltip>
          </FieldDescription>
        </FieldLegend>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-4 text-primary hover:bg-muted hover:text-primary"
          onClick={() => append({ name: '', type: 'fromValue', value: '' })}
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
              name={`headers.${index}.name`}
              control={form.control}
              render={({ field: controllerField, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="col-span-3">
                  <Input
                    {...controllerField}
                    id={`headers.${index}.name`}
                    aria-invalid={fieldState.invalid}
                    placeholder="Header name"
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
                name={`headers.${index}.type`}
                control={form.control}
                render={({ field: controllerField, fieldState }) => (
                  <Field
                    orientation="responsive"
                    data-invalid={fieldState.invalid}
                  >
                    <Select
                      name={controllerField.name}
                      value={controllerField.value}
                      onValueChange={controllerField.onChange}
                    >
                      <SelectTrigger
                        id={`headers.${index}.type`}
                        aria-invalid={fieldState.invalid}
                        className="relative min-w-[120px] max-w-60 rounded-r-none border-r-0 text-foreground focus:z-10"
                      >
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent position="item-aligned">
                        {headerTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldContent
                      className={cn(!fieldState.invalid && 'hidden')}
                    >
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </FieldContent>
                  </Field>
                )}
              />
              <Controller
                name={`headers.${index}.value`}
                control={form.control}
                render={({ field: controllerField, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="col-span-4"
                  >
                    <Input
                      {...controllerField}
                      id={`headers.${index}.value`}
                      aria-invalid={fieldState.invalid}
                      placeholder={
                        field.type === 'fromValue'
                          ? 'Header value'
                          : 'Env variable'
                      }
                      className="relative rounded-l-none text-foreground focus:z-10"
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
