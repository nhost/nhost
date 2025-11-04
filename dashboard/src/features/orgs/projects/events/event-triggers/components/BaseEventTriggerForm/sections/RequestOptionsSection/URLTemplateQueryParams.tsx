import { Field, FieldError } from '@/components/ui/v3/field';
import { Textarea } from '@/components/ui/v3/textarea';
import { type BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { Controller, useFormContext } from 'react-hook-form';

export default function URLTemplateQueryParams() {
  const form = useFormContext<BaseEventTriggerFormValues>();

  return (
    <Controller
      name="requestTransform.queryParams.queryParamsURL"
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <Textarea
            {...field}
            id="requestTransform.queryParams.queryParamsURL"
            aria-invalid={fieldState.invalid}
            placeholder={`You can also use Kriti Template here to customise the query parameter string.

e.g. {{concat(["userId=", $session_variables["x-hasura-user-id"]])}}`}
            className="min-h-[120px] max-w-lg text-foreground"
          />
          {/* <FieldDescription>
            You can also use Kriti Template here to customise the query
            parameter string.
            <br />
            e.g.{' '}
            {`{{concat(["userId=", $session_variables["x-hasura-user-id"]])}}`}
          </FieldDescription> */}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}
