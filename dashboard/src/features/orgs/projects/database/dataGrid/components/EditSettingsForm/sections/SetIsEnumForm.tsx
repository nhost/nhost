import { SettingsContainer } from '@/components/layout/SettingsContainer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const validationSchema = z.object({
  isEnum: z.boolean(),
});

export default function SetIsEnumForm() {
  const form = useForm({
    defaultValues: {
      isEnum: false,
    },
    resolver: zodResolver(validationSchema),
  });
  const { formState } = form;

  const handleFormSubmit = form.handleSubmit(async () => {
    // TODO: Integrate with the data grid settings API.
  });

  return (
    <Form {...form}>
      <form
        onSubmit={handleFormSubmit}
        className="flex flex-auto flex-col gap-4 overflow-y-auto px-6 pb-4"
      >
        <SettingsContainer
          title="Set Table as Enum"
          description="Expose the table values as GraphQL enums in the GraphQL API"
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
        >
          <div className="grid gap-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Requirements</p>
            <ul className="grid list-disc gap-1 pl-5">
              <li>
                Use a single-column primary key of type <code>text</code> whose
                values are valid GraphQL enum names.
              </li>
              <li>
                Optionally add a second <code>text</code> column to describe
                each enum value in the GraphQL schema.
              </li>
              <li>Do not add any additional columns to the table.</li>
              <li>Ensure the table contains at least one row.</li>
            </ul>
          </div>
          <FormField
            control={form.control}
            name="isEnum"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="grid gap-1">
                    <FormLabel className="text-base font-medium">
                      Is Enum
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsContainer>
      </form>
    </Form>
  );
}
