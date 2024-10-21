import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';

import {
  GetRolesPermissionsDocument,
  useGetObservabilitySettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

import { Divider } from '@/components/ui/v2/Divider';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { DiscordFormSection } from '@/features/orgs/projects/metrics/settings/components/DiscordFormSection';
import { EmailsFormSection } from '@/features/orgs/projects/metrics/settings/components/EmailsFormSection';
import { PagerdutyFormSection } from '@/features/orgs/projects/metrics/settings/components/PagerdutyFormSection';
import { SlackFormSection } from '@/features/orgs/projects/metrics/settings/components/SlackFormSection';
import { WebhookFormSection } from '@/features/orgs/projects/metrics/settings/components/WebhookFormSection';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { removeTypename } from '@/utils/helpers';
import { yupResolver } from '@hookform/resolvers/yup';
import type { ContactPointsFormValues } from './ContactPointsSettingsTypes';
import { validationSchema } from './ContactPointsSettingsTypes';

export default function ContactPointsSettings() {
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { project, refetch: refetchProject } = useProject();
  const { openDialog } = useDialog();

  const { data, loading, error, refetch } = useGetObservabilitySettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  console.log('Data:', data?.config?.observability?.grafana);

  const { emails } = data?.config?.observability?.grafana?.contacts || {};

  const form = useForm<ContactPointsFormValues>({
    defaultValues: {
      emails: [],
      discord: [],
      pagerduty: [],
    },
    values: {
      emails: emails?.map((email) => ({ email })) || [],
      discord: [],
      pagerduty: [],
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetRolesPermissionsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const getFormattedConfig = (values: ContactPointsFormValues) => {
    // Remove any __typename property from the values
    const sanitizedValues = removeTypename(values) as ContactPointsFormValues;

    return sanitizedValues;
  };

  const createOrUpdateContactPoint = async (
    values: ContactPointsFormValues,
  ) => {
    console.log(values);

    const newEmails = values.emails?.map((email) => email.email) ?? null;

    // Update service config
    await updateConfig({
      variables: {
        appId: project.id,
        config: {
          observability: {
            grafana: {
              contacts: {
                emails: newEmails,
              },
            },
          },
        },
      },
    });
  };

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading contact points..." />;
  }

  if (error) {
    throw error;
  }

  async function showApplyChangesDialog() {
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
  }

  const handleSubmit = async (formValues: ContactPointsFormValues) => {
    console.log(formValues);

    const newEmails = formValues.emails?.map((email) => email.email) ?? null;

    // Update service config
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          observability: {
            grafana: {
              contacts: {
                emails: newEmails,
              },
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
        await refetch();

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
        loadingMessage: 'Contact points are being updated...',
        successMessage: 'Contact points have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update contact points.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Contact Points"
          description="Select your preferred emails for receiving notifications when your alert rules are firing."
          docsLink="https://docs.nhost.io/platform/metrics#configure-contact-points"
          rootClassName="gap-0"
          className={twMerge('my-2 px-0')}
          slotProps={{
            submitButton: {
              disabled: !form.formState.isDirty || maintenanceActive,
              loading: form.formState.isSubmitting,
            },
          }}
        >
          <Divider />
          <EmailsFormSection />
          <Divider />
          <PagerdutyFormSection />
          <Divider />
          <DiscordFormSection />
          <Divider />
          <SlackFormSection />
          <Divider />
          <WebhookFormSection />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
