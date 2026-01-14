import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/v3/input-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import {
  cronRequestOptionsTransformQueryParamsTypeOptions,
  cronRequestTransformMethods,
  type BaseCronTriggerFormValues,
} from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import { useFormContext } from 'react-hook-form';
import KeyValueQueryParams from './KeyValueQueryParams';
import RequestURLTransformPreview from './RequestURLTransformPreview';
import URLTemplateQueryParams from './URLTemplateQueryParams';

interface RequestOptionsSectionProps {
  className?: string;
}

export default function RequestOptionsSection({
  className,
}: RequestOptionsSectionProps) {
  const form = useFormContext<BaseCronTriggerFormValues>();
  const { watch } = form;

  const queryParamsType = watch(
    'requestOptionsTransform.queryParams.queryParamsType',
  );

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="flex flex-col gap-8">
        <FormField
          name="requestOptionsTransform.method"
          control={form.control}
          render={({ field }) => (
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground text-sm">
                  Request Method
                </h4>
              </div>
              <FormControl>
                <RadioGroup
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-row items-center gap-12"
                >
                  {cronRequestTransformMethods.map((requestTransformMethod) => (
                    <FormItem
                      key={requestTransformMethod}
                      className="flex w-auto flex-row items-center space-x-2 space-y-0"
                    >
                      <FormControl>
                        <RadioGroupItem
                          value={requestTransformMethod}
                          id={`request-options-transform-method-${requestTransformMethod}`}
                        />
                      </FormControl>
                      <FormLabel
                        htmlFor={`request-options-transform-method-${requestTransformMethod}`}
                        className="cursor-pointer font-normal text-foreground"
                      >
                        {requestTransformMethod}
                      </FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </div>
          )}
        />
        <FormField
          name="requestOptionsTransform.urlTemplate"
          control={form.control}
          render={({ field }) => (
            <FormItem className="max-w-lg">
              <FormLabel className="text-foreground">
                Request URL Template
              </FormLabel>
              <FormControl>
                <InputGroup>
                  <InputGroupAddon className="border-r pr-2">
                    <InputGroupText>{'{{$base_url}}'}</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    {...field}
                    id="requestOptionsTransform.urlTemplate"
                    placeholder="URL Template (Optional)..."
                    className="w-full pl-2 text-foreground aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus:ring-destructive/20"
                    wrapperClassName="w-full"
                  />
                </InputGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="requestOptionsTransform.queryParams.queryParamsType"
          control={form.control}
          render={({ field }) => (
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground text-sm">
                  Query params type
                </h4>
              </div>
              <FormControl>
                <RadioGroup
                  name={field.name}
                  value={field.value}
                  defaultValue={
                    cronRequestOptionsTransformQueryParamsTypeOptions[0]
                  }
                  onValueChange={field.onChange}
                  className="flex flex-row items-center gap-12"
                >
                  {cronRequestOptionsTransformQueryParamsTypeOptions.map(
                    (requestOptionsTransformQueryParamsType) => (
                      <FormItem
                        key={requestOptionsTransformQueryParamsType}
                        className="flex w-auto flex-row items-center space-x-2 space-y-0"
                      >
                        <FormControl>
                          <RadioGroupItem
                            value={requestOptionsTransformQueryParamsType}
                            id={`request-options-transform-query-params-type-${requestOptionsTransformQueryParamsType}`}
                          />
                        </FormControl>
                        <FormLabel
                          htmlFor={`request-options-transform-query-params-type-${requestOptionsTransformQueryParamsType}`}
                          className="cursor-pointer font-normal text-foreground"
                        >
                          {requestOptionsTransformQueryParamsType}
                        </FormLabel>
                      </FormItem>
                    ),
                  )}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </div>
          )}
        />
        {queryParamsType === 'Key Value' ? (
          <KeyValueQueryParams />
        ) : (
          <URLTemplateQueryParams />
        )}
        <RequestURLTransformPreview />
      </div>
    </div>
  );
}
