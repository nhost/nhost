import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
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
import { Textarea } from '@/components/ui/v3/textarea';
import { IconTooltip } from '@/features/orgs/projects/common/components/IconTooltip';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { getSampleInputPayload } from '@/features/orgs/projects/events/event-triggers/utils/getSampleInputPayload';
import { RefreshCw } from 'lucide-react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import TransformedRequestBody from './TransformedRequestBody';

interface PayloadTransformSectionProps {
  className?: string;
}

export default function PayloadTransformSection({
  className,
}: PayloadTransformSectionProps) {
  const form = useFormContext<BaseEventTriggerFormValues>();
  const { watch, setValue } = form;
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'payloadTransform.requestBodyTransform.formTemplate',
  });

  const values = watch();

  const selectedTableSchema = watch('tableSchema');
  const selectedTableName = watch('tableName');

  const { data: selectedTableData } = useTableQuery(
    [`default.${selectedTableSchema}.${selectedTableName}`],
    {
      schema: selectedTableSchema,
      table: selectedTableName,
      queryOptions: {
        enabled: !!selectedTableSchema && !!selectedTableName,
      },
    },
  );

  const handleRefreshPayload = () => {
    setValue(
      'payloadTransform.sampleInput',
      getSampleInputPayload({
        formValues: values,
        columns: selectedTableData?.columns,
      }),
    );
  };

  return (
    <FieldSet className={className}>
      <FieldLegend className="text-foreground">Payload Transform</FieldLegend>
      <FieldDescription>
        Change the payload to adapt to your API&apos;s expected format.
      </FieldDescription>
      <FieldGroup className="flex flex-col gap-12">
        <Controller
          name="payloadTransform.sampleInput"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex flex-row items-center gap-2">
                <FieldLabel
                  htmlFor="payloadTransform.sampleInput"
                  className="text-foreground"
                >
                  Sample Input
                </FieldLabel>
                <FieldDescription>
                  <IconTooltip>
                    <p>Sample input defined by your definition.</p>
                  </IconTooltip>
                </FieldDescription>
                <Button
                  className="flex flex-row items-center gap-2"
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={handleRefreshPayload}
                >
                  <RefreshCw className="size-4" />
                  Refresh
                </Button>
              </div>
              <Textarea
                {...field}
                id="payloadTransform.sampleInput"
                aria-invalid={fieldState.invalid}
                className="min-h-[250px] max-w-lg font-mono text-foreground"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <FieldSet>
          <FieldLegend variant="label" className="text-foreground">
            Request Body Transform
          </FieldLegend>
          <div className="flex flex-row items-center justify-between gap-8">
            <FieldDescription className="flex max-w-xs flex-row items-center gap-2">
              The template which will transform your request body into the
              required specification.{' '}
              <div className="flex-1">
                <IconTooltip>
                  <p>
                    You can use {'{{$body}}'} to access the original request
                    body
                  </p>
                </IconTooltip>
              </div>
            </FieldDescription>
            <Controller
              name="payloadTransform.requestBodyTransform.requestBodyTransformType"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field
                  orientation="responsive"
                  data-invalid={fieldState.invalid}
                  className="mr-1 flex w-auto"
                >
                  <FieldContent className="flex flex-initial">
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </FieldContent>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="payloadTransform.requestBodyTransform.requestBodyTransformType"
                      aria-invalid={fieldState.invalid}
                      className="min-w-[120px] text-left text-foreground"
                    >
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent position="item-aligned">
                      {[
                        'disabled',
                        'application/json',
                        'application/x-www-form-urlencoded',
                      ].map((requestBodyTransformType) => (
                        <SelectItem
                          key={requestBodyTransformType}
                          value={requestBodyTransformType}
                        >
                          {requestBodyTransformType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>
          {values?.payloadTransform?.requestBodyTransform
            ?.requestBodyTransformType === 'application/json' && (
            <Controller
              name="payloadTransform.requestBodyTransform.template"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel
                    htmlFor="payloadTransform.requestBodyTransform.template"
                    className="text-foreground"
                  >
                    Request Body Transform JSON Template
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id="payloadTransform.requestBodyTransform.template"
                    aria-invalid={fieldState.invalid}
                    className="min-h-[250px] max-w-lg font-mono text-foreground"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}
          {values?.payloadTransform?.requestBodyTransform
            ?.requestBodyTransformType ===
            'application/x-www-form-urlencoded' && (
            <FieldSet className="max-w-lg">
              <div className="flex items-center justify-between">
                <FieldLegend
                  variant="label"
                  className="flex flex-row items-center gap-2 text-foreground"
                >
                  Form Template
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
                      name={`payloadTransform.requestBodyTransform.formTemplate.${index}.key`}
                      control={form.control}
                      render={({ field: controllerField, fieldState }) => (
                        <Field
                          data-invalid={fieldState.invalid}
                          className="col-span-3"
                        >
                          <Input
                            {...controllerField}
                            id={`payloadTransform.requestBodyTransform.formTemplate.${index}.key`}
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
                    <span className="col-span-1 text-center text-foreground">
                      :
                    </span>
                    <div className="col-span-4 flex items-center">
                      <Controller
                        name={`payloadTransform.requestBodyTransform.formTemplate.${index}.value`}
                        control={form.control}
                        render={({ field: controllerField, fieldState }) => (
                          <Field
                            data-invalid={fieldState.invalid}
                            className="col-span-4"
                          >
                            <Input
                              {...controllerField}
                              id={`payloadTransform.requestBodyTransform.formTemplate.${index}.value`}
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
          )}
          {values?.payloadTransform?.requestBodyTransform
            ?.requestBodyTransformType === 'disabled' && (
            <Alert variant="destructive" className="max-w-lg">
              <AlertTitle>Request Body Transformation Disabled</AlertTitle>
              <AlertDescription>
                The request body is disabled. No request body will be sent with
                this event trigger. Enable the request body transform to
                customize the payload sent with this event trigger.
              </AlertDescription>
            </Alert>
          )}
        </FieldSet>
        <TransformedRequestBody />
      </FieldGroup>
    </FieldSet>
  );
}
