import ControlledSelect from '@/components/common/ControlledSelect';
import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
import {
  GetAuthenticationSettingsDocument,
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Option from '@/ui/v2/Option';
import getServerError from '@/utils/settings/getServerError';
import {
  AUTH_GRAVATAR_DEFAULT,
  AUTH_GRAVATAR_RATING,
  getToastStyleProps,
} from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  default: Yup.string().label('Default Gravatar'),
  rating: Yup.string().label('Gravatar Rating'),
});

export type GravatarFormValues = Yup.InferType<typeof validationSchema>;

export default function GravatarSettings() {
  const { projectManagementDisabled } = useUI();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetAuthenticationSettingsDocument],
  });

  const { data, loading, error } = useGetAuthenticationSettingsQuery({
    variables: { appId: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const {
    default: defaultGravatar,
    rating,
    enabled,
  } = data?.config?.auth?.user?.gravatar || {};

  const form = useForm<GravatarFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      default: defaultGravatar || '',
      rating: rating || '',
      enabled: enabled || false,
    },
    resolver: yupResolver(validationSchema),
  });

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
  const gravatarEnabled = watch('enabled') ?? false;

  const handleGravatarSettingsChange = async (values: GravatarFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentApplication.id,
        config: {
          auth: {
            user: {
              gravatar: values,
            },
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Gravatar settings are being updated...`,
          success: `Gravatar settings have been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the project's Gravatar settings.`,
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
      <Form onSubmit={handleGravatarSettingsChange}>
        <SettingsContainer
          title="Gravatar"
          description="Use Gravatars for avatar URLs for users."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || projectManagementDisabled,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/authentication#gravatar"
          switchId="enabled"
          showSwitch
          className={twMerge(
            'grid grid-flow-col grid-cols-5 grid-rows-2 gap-y-6',
            !gravatarEnabled && 'hidden',
          )}
        >
          <ControlledSelect
            {...register('default')}
            id="default"
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
            {...register('rating')}
            id="rating"
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
