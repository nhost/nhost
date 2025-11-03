import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/v3/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/v3/input-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import {
  requestTransformMethods,
  type BaseEventTriggerFormValues,
} from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { Controller, useFormContext } from 'react-hook-form';

interface RequestOptionsSectionProps {
  className?: string;
}

export default function RequestOptionsSection({
  className,
}: RequestOptionsSectionProps) {
  const form = useFormContext<BaseEventTriggerFormValues>();
  return (
    <FieldSet className={className}>
      <FieldLegend className="text-foreground">Request Options</FieldLegend>
      <FieldDescription>
        Configuration to transform the request before sending it to the webhook
      </FieldDescription>
      <FieldGroup className="flex flex-col gap-8">
        <Controller
          name="requestTransform.method"
          control={form.control}
          render={({ field, fieldState }) => (
            <FieldSet
              data-invalid={fieldState.invalid}
              className="flex lg:flex-row"
            >
              <FieldLegend variant="label" className="text-foreground">
                Request Method
              </FieldLegend>
              <RadioGroup
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
                aria-invalid={fieldState.invalid}
                className="flex flex-row items-center gap-12"
              >
                {requestTransformMethods.map((requestTransformMethod) => (
                  <Field
                    key={requestTransformMethod}
                    orientation="horizontal"
                    data-invalid={fieldState.invalid}
                    className="w-auto"
                  >
                    <RadioGroupItem
                      value={requestTransformMethod}
                      id={`request-transform-method-${requestTransformMethod}`}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldLabel
                      htmlFor={`request-transform-method-${requestTransformMethod}`}
                      className="font-normal text-foreground"
                    >
                      {requestTransformMethod}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </FieldSet>
          )}
        />
        <Controller
          name="requestTransform.urlTemplate"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="max-w-lg">
              <FieldLabel
                htmlFor="requestTransform.urlTemplate"
                className="text-foreground"
              >
                Request URL Template
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon className="border-r pr-2">
                  <InputGroupText>{'{{$base_url}}'}</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  {...field}
                  id="requestTransform.urlTemplate"
                  aria-invalid={fieldState.invalid}
                  placeholder="URL Template (Optional)..."
                  className="w-full pl-2 text-foreground"
                  wrapperClassName="w-full"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </InputGroup>
            </Field>
          )}
        />
      </FieldGroup>
    </FieldSet>
  );
}
