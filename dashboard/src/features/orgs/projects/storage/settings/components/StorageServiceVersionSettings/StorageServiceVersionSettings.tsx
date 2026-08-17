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
  useGetSoftwareVersionsQuery,
  useGetStorageSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { isEmptyValue } from '@/lib/utils';

const validationSchema = Yup.object({
  version: Yup.string().required().label('Storage Version'),
});

export type StorageServiceVersionFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function StorageServiceVersionSettings() {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetStorageSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data: storageVersionsData } = useGetSoftwareVersionsQuery({
    variables: {
      software: Software_Type_Enum.Storage,
    },
    skip: !isPlatform,
  });

  const { version } = data?.config?.storage || {};

  const availableVersions = useMemo(() => {
    const versions = storageVersionsData?.softwareVersions || [];

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
  }, [storageVersionsData?.softwareVersions, version]);

  const form = useForm<StorageServiceVersionFormValues>({
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

  const handleStorageServiceVersionsChange = async (
    formValues: StorageServiceVersionFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
        config: {
          storage: {
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
        loadingMessage: 'Storage version is being updated...',
        successMessage: 'Storage version has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update Storage version.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleStorageServiceVersionsChange}>
        <SettingsCard>
          <SettingsCardHeader
            title="Storage Version"
            description="The version of Storage to use."
          />

          <SettingsCardContent className="gap-x-4 gap-y-2 lg:grid-cols-5">
            <FormFreeCombobox
              name="version"
              className="lg:col-span-3"
              options={availableVersions}
              control={form.control}
              placeholder="Select Storage Version"
              customValueLabel={(val) => `Use custom value: "${val}"`}
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://github.com/nhost/hasura-storage/releases"
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
