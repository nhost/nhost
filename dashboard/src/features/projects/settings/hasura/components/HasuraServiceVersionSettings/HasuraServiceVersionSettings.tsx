import { ControlledSelect } from '@/components/common/ControlledSelect';
import { Form } from '@/components/common/Form';
import { SettingsContainer } from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useDockerImageTags } from '@/features/projects/settings/common/hooks/useDockerImageTags';
import {
  GetHasuraSettingsDocument,
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { ActivityIndicator } from '@/ui/v2/ActivityIndicator';
import { Option } from '@/ui/v2/Option';
import { getServerError } from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  version: Yup.string().label('Hasura Version'),
});

export type HasuraServiceVersionFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function HasuraServiceVersionSettings() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetHasuraSettingsDocument],
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const {
    data: tags,
    error: dockerError,
    status: dockerStatus,
  } = useDockerImageTags({ image: 'hasura/graphql-engine' });

  const { version } = data?.config?.hasura || {};
  const availableVersions = Array.from(new Set(tags).add(version))
    .sort()
    .reverse();

  const form = useForm<HasuraServiceVersionFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: { version },
    resolver: yupResolver(validationSchema),
  });

  // We don't want to hide the form while the docker tags are being fetched
  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Hasura version..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleHasuraServiceVersionsChange = async (
    values: HasuraServiceVersionFormValues,
  ) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          hasura: {
            version: values.version,
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Hasura version is being updated...`,
          success: `Hasura version has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update Hasura version.`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(values);
    } catch {
      // Note: The toast will handle the error.
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleHasuraServiceVersionsChange}>
        <SettingsContainer
          title="Hasura GraphQL Engine Version"
          description="The version of the Hasura GraphQL Engine to use."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://github.com/hasura/graphql-engine/releases"
          docsTitle="the latest releases"
          className="grid grid-flow-row gap-y-2 gap-x-4 px-4 lg:grid-cols-5"
        >
          <ControlledSelect
            id="version"
            name="version"
            fullWidth
            className="col-span-2"
            aria-label="Hasura Version"
            error={!!dockerError?.message}
            helperText={dockerError?.message}
          >
            {availableVersions.map((availableVersion) => (
              <Option value={availableVersion} key={availableVersion}>
                {availableVersion}
              </Option>
            ))}
          </ControlledSelect>

          {dockerStatus === 'loading' && (
            <ActivityIndicator
              label="Loading available images..."
              className="col-span-3"
              delay={2000}
            />
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
