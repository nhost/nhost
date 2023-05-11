import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetSignInMethodsDocument,
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import IconButton from '@/ui/v2/IconButton';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { copy } from '@/utils/copy';
import getServerError from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  consumerSecret: Yup.string()
    .label('Consumer Secret')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  consumerKey: Yup.string()
    .label('Consumer Key')
    .when('enabled', {
      is: true,
      then: (schema) => schema.required(),
    }),
  enabled: Yup.boolean(),
});

export type TwitterProviderFormValues = Yup.InferType<typeof validationSchema>;

export default function TwitterProviderSettings() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSignInMethodsDocument],
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const { consumerKey, consumerSecret, enabled } =
    data?.config?.auth?.method?.oauth?.twitter || {};

  const form = useForm<TwitterProviderFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      consumerSecret: consumerSecret || '',
      consumerKey: consumerKey || '',
      enabled: enabled || false,
    },
    resolver: yupResolver(validationSchema),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading settings for Twitter..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState, watch } = form;
  const authEnabled = watch('enabled');

  const handleProviderUpdate = async (values: TwitterProviderFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            method: {
              oauth: {
                twitter: values,
              },
            },
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Twitter settings are being updated...`,
          success: `Twitter settings have been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the project's Twitter settings.`,
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
      <Form onSubmit={handleProviderUpdate}>
        <SettingsContainer
          title="Twitter"
          description="Allow users to sign in with Twitter."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsTitle="how to sign in users with Twitter"
          icon="/assets/brands/twitter.svg"
          switchId="enabled"
          showSwitch
          className={twMerge(
            'grid-flow-rows grid grid-cols-2 grid-rows-2 gap-y-4 gap-x-3 px-4 py-2',
            !authEnabled && 'hidden',
          )}
        >
          <Input
            {...register(`consumerKey`)}
            name="consumerKey"
            id="consumerKey"
            label="Twitter Consumer Key"
            placeholder="Twitter Consumer Key"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.consumerKey}
            helperText={formState.errors?.consumerKey?.message}
          />
          <Input
            {...register('consumerSecret')}
            name="consumerSecret"
            id="consumerSecret"
            label="Twitter Consumer Secret"
            placeholder="Twitter Consumer Secret"
            className="col-span-1"
            fullWidth
            hideEmptyHelperText
            error={!!formState.errors?.consumerSecret}
            helperText={formState.errors?.consumerSecret?.message}
          />
          <Input
            name="redirectUrl"
            id="redirectUrl"
            defaultValue={`${generateAppServiceUrl(
              currentProject.subdomain,
              currentProject.region.awsName,
              'auth',
            )}/signin/provider/twitter/callback`}
            className="col-span-2"
            fullWidth
            hideEmptyHelperText
            label="Redirect URL"
            disabled
            endAdornment={
              <InputAdornment position="end" className="absolute right-2">
                <IconButton
                  sx={{ minWidth: 0, padding: 0 }}
                  color="secondary"
                  variant="borderless"
                  onClick={(e) => {
                    e.stopPropagation();
                    copy(
                      `${generateAppServiceUrl(
                        currentProject.subdomain,
                        currentProject.region.awsName,
                        'auth',
                      )}/signin/provider/twitter/callback`,
                      'Redirect URL',
                    );
                  }}
                >
                  <CopyIcon className="h-4 w-4" />
                </IconButton>
              </InputAdornment>
            }
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
