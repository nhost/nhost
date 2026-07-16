import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormFreeCombobox } from '@/components/form/FormFreeCombobox';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  Software_Type_Enum,
  useGetHasuraSettingsQuery,
  useGetSoftwareVersionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { isNotEmptyValue } from '@/lib/utils';

const validationSchema = Yup.object({
  version: Yup.string().required().label('Hasura Version'),
});

export type HasuraServiceVersionFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function HasuraServiceVersionSettings() {
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const localMimirClient = useLocalMimirClient();
  const { project, refetch: refetchProject } = useProject();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data: hasuraVersionsData } = useGetSoftwareVersionsQuery({
    variables: {
      software: Software_Type_Enum.Hasura,
    },
    skip: !isPlatform,
  });

  const version = data?.config?.hasura.version;
  const availableVersions = useMemo(() => {
    const versions = hasuraVersionsData?.softwareVersions || [];
    const optionsSet = new Set(versions.map((el) => el.version));
    if (isNotEmptyValue(version)) {
      optionsSet.add(version);
    }

    return Array.from(optionsSet)
      .filter((v) => !!v)
      .sort()
      .reverse()
      .map((availableVersion) => ({
        label: availableVersion,
        value: availableVersion,
      }));
  }, [version, hasuraVersionsData?.softwareVersions]);

  const form = useForm<HasuraServiceVersionFormValues>({
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

  async function handleSubmit(formValues: HasuraServiceVersionFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          hasura: {
            version: formValues.version,
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
        await refetchProject();

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
        loadingMessage: 'Hasura version is being updated...',
        successMessage: 'Hasura version has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update Hasura version.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Hasura GraphQL Engine Version"
          description="The version of the Hasura GraphQL Engine to use."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://hub.docker.com/r/nhost/graphql-engine/tags"
          docsTitle="the latest releases"
          className="grid grid-flow-row gap-x-4 gap-y-2 px-4 lg:grid-cols-5"
        >
          <FormFreeCombobox
            name="version"
            className="lg:col-span-3"
            options={availableVersions}
            control={form.control}
            placeholder="Select Hasura Version"
            customValueLabel={(val) => `Use custom value: "${val}"`}
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
