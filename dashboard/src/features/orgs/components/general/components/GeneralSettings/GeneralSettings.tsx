import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v3/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUpdateOrganizationMutation } from '@/utils/__generated__/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { zodResolver } from '@hookform/resolvers/zod';
import { CopyIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

const updateOrgFormSchema = z.object({
  name: z.string().min(2),
});

export default function GeneralSettings() {
  const { org } = useCurrentOrg();

  const form = useForm<z.infer<typeof updateOrgFormSchema>>({
    resolver: zodResolver(updateOrgFormSchema),
    defaultValues: {
      name: org?.name || '',
    },
  });

  useEffect(() => {
    if (org?.name !== undefined) {
      form.setValue('name', org.name, { shouldDirty: false });
    }
  }, [org, form]);

  const [updateOrganization] = useUpdateOrganizationMutation();

  const onSubmit = async (values: z.infer<typeof updateOrgFormSchema>) => {
    const { id } = org;
    const { name } = values;

    await execPromiseWithErrorToast(
      async () => {
        await updateOrganization({
          variables: {
            id,
            organization: {
              name,
            },
          },
        });

        form.reset({ name });
      },
      {
        loadingMessage: 'Updating organization',
        successMessage: 'Successfully updated the organization',
        errorMessage: 'An error occurred while updating the organization!',
      },
    );
  };

  const toastStyle = getToastStyleProps();

  const copySlugToClipboard = () => {
    navigator.clipboard.writeText(org?.slug ?? ''); // Ensure default value
    toast.success('Organization slug copied.', {
      style: toastStyle.style,
      ...toastStyle.success,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex w-full flex-col rounded-md border bg-background">
          <div className="w-full border-b p-4 font-medium">
            General Settings
          </div>

          <div className="flex w-full flex-col gap-4 p-4 sm:max-w-lg">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Inc" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <Label htmlFor="slug">Organization slug</Label>
              <div className="relative">
                <Input
                  id="slug"
                  disabled
                  value={org?.slug ?? ''}
                  className="disabled:opacity-100"
                />
                <Button
                  onClick={copySlugToClipboard}
                  className="absolute right-0 top-0"
                  type="button"
                  variant="ghost"
                >
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t p-2">
            <Button type="submit" disabled={!form.formState.isDirty}>
              {form.formState.isSubmitting ? <ActivityIndicator /> : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
