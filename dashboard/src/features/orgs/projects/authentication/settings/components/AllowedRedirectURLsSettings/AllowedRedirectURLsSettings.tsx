import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

const validationSchema = Yup.object({
  allowedUrls: Yup.string().label('Allowed Redirect URLs'),
});

export type AllowedRedirectURLFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function AllowedRedirectURLsSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { allowedUrls } = data?.config?.auth?.redirections || {};

  const form = useForm<AllowedRedirectURLFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      allowedUrls: allowedUrls?.join(', ') || '',
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && allowedUrls) {
      form.reset({
        allowedUrls: allowedUrls?.join(', ') || '',
      });
    }
  }, [loading, allowedUrls, form]);

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleAllowedRedirectURLsChange = async (
    values: AllowedRedirectURLFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          auth: {
            redirections: {
              allowedUrls: values.allowedUrls
                ? values.allowedUrls.split(',').map((url) => url.trim())
                : [],
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(values);

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
      },
      {
        loadingMessage: 'Allowed redirect URL settings are being updated...',
        successMessage:
          'Allowed redirect URL settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's allowed redirect URL settings.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleAllowedRedirectURLsChange}>
        <SettingsCard>
          <SettingsCardHeader
            title="Allowed Redirect URLs"
            description="Allowed URLs where users can be redirected to after authentication. Separate multiple redirect URLs with comma."
          />

          <SettingsCardContent className="lg:grid-cols-5">
            <FormInput
              control={form.control}
              name="allowedUrls"
              placeholder="http://localhost:3000, http://localhost:4000"
              containerClassName="col-span-2"
              aria-label="Allowed Redirect URLs"
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/products/auth/client_and_redirect_urls#allowed-redirect-urls"
              title="Allowed Redirect URLs"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!formState.isDirty}
              loading={formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              Save
            </ButtonWithLoading>
          </SettingsCardFooter>
        </SettingsCard>
      </Form>
    </FormProvider>
  );
}
