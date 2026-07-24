import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormSelect } from '@/components/form/FormSelect';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { FormField } from '@/components/ui/v3/form';
import { SelectItem } from '@/components/ui/v3/select';
import { Switch } from '@/components/ui/v3/switch';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetAuthenticationSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import {
  AUTH_GRAVATAR_DEFAULT,
  AUTH_GRAVATAR_RATING,
} from '@/utils/constants/settings';

const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  default: Yup.string().label('Default Gravatar'),
  rating: Yup.string().label('Gravatar Rating'),
});

export type GravatarFormValues = Yup.InferType<typeof validationSchema>;

export default function GravatarSettings() {
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

  useEffect(() => {
    if (!loading) {
      form.reset({
        default: defaultGravatar || '',
        rating: rating || '',
        enabled: enabled || false,
      });
    }
  }, [loading, defaultGravatar, rating, enabled, form]);

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const gravatarEnabled = watch('enabled') ?? false;

  const handleGravatarSettingsChange = async (values: GravatarFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project!.id,
        config: {
          auth: {
            user: {
              gravatar: values,
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
        loadingMessage: 'Gravatar settings are being updated...',
        successMessage: 'Gravatar settings have been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's Gravatar settings.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleGravatarSettingsChange}>
        <SettingsCard>
          <SettingsCardHeader
            title="Gravatar"
            description="Use Gravatars for avatar URLs for users."
            control={
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-label="Toggle Gravatar"
                  />
                )}
              />
            }
          />

          <SettingsCardContent
            className={twMerge(
              'grid grid-flow-col grid-cols-5 grid-rows-2 gap-y-6',
              !gravatarEnabled && 'hidden',
            )}
          >
            <FormSelect
              control={form.control}
              name="default"
              containerClassName="col-span-5 lg:col-span-2"
              placeholder="Default Gravatar"
              label="Default"
            >
              {AUTH_GRAVATAR_DEFAULT.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </FormSelect>
            <FormSelect
              control={form.control}
              name="rating"
              containerClassName="col-span-5 lg:col-span-2"
              placeholder="Gravatar Rating"
              label="Rating"
            >
              {AUTH_GRAVATAR_RATING.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </FormSelect>
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/products/auth/gravatar"
              title="Gravatar"
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
