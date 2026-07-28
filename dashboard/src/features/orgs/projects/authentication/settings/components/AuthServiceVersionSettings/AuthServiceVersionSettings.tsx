import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormFreeCombobox } from '@/components/form/FormFreeCombobox';
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
  Software_Type_Enum,
  useGetAuthenticationSettingsQuery,
  useGetSoftwareVersionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { isEmptyValue } from '@/lib/utils';

const validationSchema = Yup.object({
  version: Yup.string().required().label('Auth Version'),
});

export type AuthServiceVersionFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function AuthServiceVersionSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data: authVersionsData } = useGetSoftwareVersionsQuery({
    variables: {
      software: Software_Type_Enum.Auth,
    },
    skip: !isPlatform,
  });

  const { version } = data?.config?.auth || {};

  const availableVersions = useMemo(() => {
    const versions = authVersionsData?.softwareVersions || [];

    if (isEmptyValue(versions)) {
      return [];
    }
    const versionSet = new Set(versions.map((el) => el.version));
    if (version) {
      versionSet.add(version);
    }
    return Array.from(versionSet)
      .sort()
      .reverse()
      .map((availableVersion) => ({
        label: availableVersion,
        value: availableVersion,
      }));
  }, [authVersionsData?.softwareVersions, version]);

  const form = useForm<AuthServiceVersionFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { version: '' },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && version) {
      form.reset({
        version,
      });
    }
  }, [loading, version, form]);

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleAuthServiceVersionsChange = async (
    formValues: AuthServiceVersionFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          auth: {
            version: formValues.version,
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);

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
        loadingMessage: 'Auth version is being updated...',
        successMessage: 'Auth version has been updated successfully.',
        errorMessage: 'An error occurred while trying to update Auth version.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleAuthServiceVersionsChange}>
        <SettingsCard>
          <SettingsCardHeader
            title="Auth Version"
            description="The version of Auth to use."
          />

          <SettingsCardContent className="gap-x-4 gap-y-2 lg:grid-cols-5">
            <FormFreeCombobox
              name="version"
              className="lg:col-span-3"
              options={availableVersions}
              control={form.control}
              placeholder="Select Auth Version"
              customValueLabel={(val) => `Use custom value: "${val}"`}
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://github.com/nhost/hasura-auth/releases"
              title="the latest releases"
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
