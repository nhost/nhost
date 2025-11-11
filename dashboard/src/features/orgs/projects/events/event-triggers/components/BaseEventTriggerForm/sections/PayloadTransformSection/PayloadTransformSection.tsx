import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { SelectItem } from '@/components/ui/v3/select';
import { Textarea } from '@/components/ui/v3/textarea';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { getSampleInputPayload } from '@/features/orgs/projects/events/event-triggers/utils/getSampleInputPayload';
import { RefreshCw } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
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
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="space-y-2">
        <h3 className="text-base font-medium text-foreground">
          Payload Transform
        </h3>
        <FormDescription>
          Change the payload to adapt to your API&apos;s expected format.
        </FormDescription>
      </div>
      <div className="flex flex-col gap-12">
        <FormField
          name="payloadTransform.sampleInput"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-row items-center gap-2">
                <FormLabel className="text-foreground">Sample Input</FormLabel>
                <FormDescription>
                  <InfoTooltip>
                    <p>Sample input defined by your definition.</p>
                  </InfoTooltip>
                </FormDescription>
                <Button
                  className="flex flex-row items-center gap-2 text-foreground"
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={handleRefreshPayload}
                >
                  <RefreshCw className="size-4" />
                  Refresh
                </Button>
              </div>
              <FormControl>
                <Textarea
                  {...field}
                  id="payloadTransform.sampleInput"
                  className="min-h-[250px] max-w-lg font-mono text-foreground aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus:ring-destructive/20"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-4">
          <div className="flex max-w-lg flex-row justify-between gap-4 text-foreground">
            <div className="flex flex-row items-center gap-2">
              <h4 className="text-sm font-medium text-foreground">
                Request Body Transform
              </h4>
              <FormDescription className="flex flex-row items-center gap-2">
                <InfoTooltip>
                  <p>
                    The template which will transform your request body into the
                    required specification.
                  </p>
                  <p>
                    You can use {'{{$body}}'} to access the original request
                    body
                  </p>
                </InfoTooltip>
              </FormDescription>
            </div>
            <FormSelect
              control={form.control}
              name="payloadTransform.requestBodyTransform.requestBodyTransformType"
              label="Transform Type"
              placeholder="Select"
              className="min-w-[120px] text-left text-foreground"
            >
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
            </FormSelect>
          </div>
          {values?.payloadTransform?.requestBodyTransform
            ?.requestBodyTransformType === 'application/json' && (
            <FormField
              name="payloadTransform.requestBodyTransform.template"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">
                    Request Body Transform JSON Template
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      id="payloadTransform.requestBodyTransform.template"
                      className="min-h-[250px] max-w-lg font-mono text-foreground aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus:ring-destructive/20"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {values?.payloadTransform?.requestBodyTransform
            ?.requestBodyTransformType ===
            'application/x-www-form-urlencoded' && (
            <div className="max-w-lg space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">
                  Form Template
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
                  <div className="grid grid-flow-row grid-cols-9 text-sm+ text-foreground">
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
                    <div className="col-span-3">
                      <FormInput
                        control={form.control}
                        name={`payloadTransform.requestBodyTransform.formTemplate.${index}.key`}
                        label=""
                        placeholder="Key"
                        className="text-foreground"
                        autoComplete="off"
                      />
                    </div>
                    <span className="col-span-1 text-center text-foreground">
                      :
                    </span>
                    <div className="col-span-4">
                      <FormInput
                        control={form.control}
                        name={`payloadTransform.requestBodyTransform.formTemplate.${index}.value`}
                        label=""
                        placeholder="Value"
                        className="text-foreground"
                        autoComplete="off"
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
              </div>
            </div>
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
        </div>
        <TransformedRequestBody />
      </div>
    </div>
  );
}
