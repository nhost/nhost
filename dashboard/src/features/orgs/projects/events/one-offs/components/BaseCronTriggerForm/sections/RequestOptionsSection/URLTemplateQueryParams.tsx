import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/v3/form';
import { Textarea } from '@/components/ui/v3/textarea';
import type { BaseCronTriggerFormValues } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';

export default function URLTemplateQueryParams() {
  const form = useFormContext<BaseCronTriggerFormValues>();

  return (
    <FormField
      name="requestOptionsTransform.queryParams.queryParamsURL"
      control={form.control}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Textarea
              {...field}
              id="requestOptionsTransform.queryParams.queryParamsURL"
              placeholder={`You can also use Kriti Template here to customise the query parameter string.

e.g. {{concat(["userId=", $session_variables["x-hasura-user-id"]])}}`}
              className="min-h-[120px] max-w-lg text-foreground aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus:ring-destructive/20"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
