import { zodResolver } from '@hookform/resolvers/zod';
import { CopyIcon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { z } from 'zod';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
} from '@/components/layout/SettingsCard';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form, FormItem } from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUpdateOrganizationMutation } from '@/generated/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';

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
      <SettingsCard asChild>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsCardContent className="sm:grid-cols-2">
            <FormInput
              control={form.control}
              name="name"
              label="Organization name"
              placeholder="Acme Inc"
            />

            <FormItem>
              <Label htmlFor="slug">Organization slug</Label>
              <div className="relative">
                <Input
                  id="slug"
                  disabled
                  value={org?.slug ?? ''}
                  className="pr-10 disabled:opacity-100"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={copySlugToClipboard}
                      className="absolute top-1 right-1"
                      type="button"
                      variant="subtle"
                      size="icon-sm"
                      aria-label="Copy slug"
                    >
                      <CopyIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy slug</TooltipContent>
                </Tooltip>
              </div>
            </FormItem>
          </SettingsCardContent>

          <SettingsCardFooter>
            <ButtonWithLoading
              type="submit"
              disabled={!form.formState.isDirty}
              loading={form.formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              Save
            </ButtonWithLoading>
          </SettingsCardFooter>
        </form>
      </SettingsCard>
    </Form>
  );
}
