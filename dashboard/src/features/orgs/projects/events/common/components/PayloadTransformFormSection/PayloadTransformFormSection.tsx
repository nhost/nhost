import { RefreshCw } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormTextarea } from '@/components/form/FormTextarea';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { SelectItem } from '@/components/ui/v3/select';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import TransformedRequestBody from './TransformedRequestBody';

interface PayloadTransformFormSectionProps {
  onResetSampleInput: () => void;
}

export default function PayloadTransformFormSection({
  onResetSampleInput,
}: PayloadTransformFormSectionProps) {
  const form = useFormContext();
  const { watch } = form;
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'payloadTransform.requestBodyTransform.formTemplate',
  });

  const values = watch();

  return (
    <div className="flex flex-col gap-6 pl-4">
      <div className="flex flex-col gap-12">
        <FormTextarea
          control={form.control}
          name="payloadTransform.sampleInput"
          label={
            <div className="flex flex-row items-center gap-2">
              <span className="text-foreground">Sample Input</span>
              <InfoTooltip>
                <p>Sample input defined by your definition.</p>
              </InfoTooltip>
              <Button
                className="flex flex-row items-center gap-2 text-foreground"
                size="sm"
                variant="outline"
                type="button"
                onClick={onResetSampleInput}
              >
                <RefreshCw className="size-4" />
                Reset
              </Button>
            </div>
          }
          className="min-h-[250px] max-w-lg font-mono text-foreground"
        />
        <div className="space-y-4">
          <div className="flex max-w-lg flex-row justify-between gap-4 text-foreground">
            <div className="flex flex-row items-center gap-2">
              <h4 className="font-medium text-foreground text-sm">
                Request Body Transform
              </h4>
              <p className="flex flex-row items-center gap-2 text-muted-foreground text-sm">
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
              </p>
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
            <FormTextarea
              control={form.control}
              name="payloadTransform.requestBodyTransform.template"
              label="Request Body Transform JSON Template"
              placeholder="Request Body Transform JSON Template"
              className="min-h-[250px] max-w-lg font-mono text-foreground"
            />
          )}
          {values?.payloadTransform?.requestBodyTransform
            ?.requestBodyTransformType ===
            'application/x-www-form-urlencoded' && (
            <div className="max-w-lg space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground text-sm">
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
                        name={`payloadTransform.requestBodyTransform.formTemplate.${index}.key`}
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
                        name={`payloadTransform.requestBodyTransform.formTemplate.${index}.value`}
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
          )}
          {values?.payloadTransform?.requestBodyTransform
            ?.requestBodyTransformType === 'disabled' && (
            <Alert variant="destructive" className="max-w-lg">
              <AlertTitle>Request Body Transformation Disabled</AlertTitle>
              <AlertDescription>
                The request body is disabled. No request body will be sent with
                this trigger. Enable the request body transform to customize the
                payload sent with this trigger.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <TransformedRequestBody />
      </div>
    </div>
  );
}
