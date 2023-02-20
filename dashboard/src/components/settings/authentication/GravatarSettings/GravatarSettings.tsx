import ControlledSelect from '@/components/common/ControlledSelect';
import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import {
  useGetGravatarSettingsQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Option from '@/ui/v2/Option';
import {
  AUTH_GRAVATAR_DEFAULT,
  AUTH_GRAVATAR_RATING,
  getToastStyleProps,
} from '@/utils/settings/settingsConstants';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface GravatarFormValues {
  /**
   * Gravatar image to use as default.
   */
  authGravatarDefault: string;
  /**
   * Gravatar image rating.
   */
  authGravatarRating: string;
  /**
   * Enable Gravatar for this project
   */
  authGravatarEnabled: boolean;
}

export default function GravatarSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useGetGravatarSettingsQuery({
    variables: {
      id: currentApplication?.id,
    },
  });

  const form = useForm<GravatarFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authGravatarDefault: data?.app?.authGravatarDefault || '',
      authGravatarRating: data?.app?.authGravatarRating || '',
      authGravatarEnabled: data?.app?.authGravatarEnabled || false,
    },
  });

  useEffect(() => {
    form.reset(() => ({
      authGravatarDefault: data?.app?.authGravatarDefault || '',
      authGravatarRating: data?.app?.authGravatarRating || '',
      authGravatarEnabled: data?.app?.authGravatarEnabled || false,
    }));
  }, [data?.app, form, form.reset]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Gravatar settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { register, formState, watch } = form;
  const authGravatarEnabled = watch('authGravatarEnabled');

  const handleGravatarSettingsChange = async (values: GravatarFormValues) => {
    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          ...values,
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `Gravatar settings are being updated...`,
        success: `Gravatar settings have been updated successfully.`,
        error: `An error occurred while trying to update the project's Gravatar settings.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleGravatarSettingsChange}>
        <SettingsContainer
          title="Gravatar"
          description="Use Gravatars for avatar URLs for users."
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          docsLink="https://docs.nhost.io/authentication#gravatar"
          switchId="authGravatarEnabled"
          showSwitch
          enabled={authGravatarEnabled}
          className={twMerge(
            'grid grid-flow-col grid-cols-5 grid-rows-2 gap-y-6',
            !authGravatarEnabled && 'hidden',
          )}
        >
          <ControlledSelect
            {...register('authGravatarDefault')}
            id="authGravatarDefault"
            className="col-span-5 lg:col-span-2"
            placeholder="Default Gravatar"
            hideEmptyHelperText
            variant="normal"
            label="Default"
          >
            {AUTH_GRAVATAR_DEFAULT.map(({ value, label }) => (
              <Option key={value} value={value}>
                {label}
              </Option>
            ))}
          </ControlledSelect>
          <ControlledSelect
            {...register('authGravatarRating')}
            id="authGravatarRating"
            className="col-span-5 lg:col-span-2"
            placeholder="Gravatar Rating"
            hideEmptyHelperText
            label="Rating"
          >
            {AUTH_GRAVATAR_RATING.map(({ value, label }) => (
              <Option key={value} value={value}>
                {label}
              </Option>
            ))}
          </ControlledSelect>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
