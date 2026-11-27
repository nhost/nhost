import { useFormContext } from 'react-hook-form';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import {
  requestOptionsTransformQueryParamsTypeOptions,
  requestTransformMethods,
} from '@/features/orgs/projects/events/common/constants';
import { cn } from '@/lib/utils';
import KeyValueQueryParams from './KeyValueQueryParams';
import RequestURLTransformPreview from './RequestURLTransformPreview';
import URLTemplateQueryParams from './URLTemplateQueryParams';

export default function RequestOptionsFormSection({
  className,
}: {
  className?: string;
}) {
  const form = useFormContext();
  const { watch } = form;

  const queryParamsType = watch(
    'requestOptionsTransform.queryParams.queryParamsType',
  );

  return (
    <div className={cn('flex flex-col gap-6 pl-4', className)}>
      <div className="flex flex-col divide-y">
        <div className="grid gap-6 pb-6 sm:grid-cols-[12rem_1fr]">
          <FormField
            name="requestOptionsTransform.method"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Method</FormLabel>
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger aria-label="Request method">
                      <SelectValue placeholder="Keep original" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {requestTransformMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="requestOptionsTransform.urlTemplate"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">URL template</FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupAddon className="border-r pr-2">
                      <InputGroupText>{'{{$base_url}}'}</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      {...field}
                      id="requestOptionsTransform.urlTemplate"
                      placeholder="/path (optional)"
                      className="w-full pl-2 text-foreground aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus:ring-destructive/20"
                      wrapperClassName="w-full"
                    />
                  </InputGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col gap-6 py-6">
          <FormField
            name="requestOptionsTransform.queryParams.queryParamsType"
            control={form.control}
            render={({ field }) => (
              <div className="flex flex-col gap-4 lg:flex-row">
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground text-sm">
                    Query parameters
                  </h4>
                </div>
                <FormControl>
                  <RadioGroup
                    name={field.name}
                    value={field.value}
                    defaultValue={
                      requestOptionsTransformQueryParamsTypeOptions[0]
                    }
                    onValueChange={field.onChange}
                    className="flex flex-row items-center gap-12"
                  >
                    {requestOptionsTransformQueryParamsTypeOptions.map(
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
        </div>
        <div className="pt-6">
          <RequestURLTransformPreview />
        </div>
      </div>
    </div>
  );
}
