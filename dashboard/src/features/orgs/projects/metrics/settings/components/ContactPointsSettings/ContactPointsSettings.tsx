import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
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
import { DiscordFormSection } from '@/features/orgs/projects/metrics/settings/components/DiscordFormSection';
import { EmailsFormSection } from '@/features/orgs/projects/metrics/settings/components/EmailsFormSection';
import { PagerdutyFormSection } from '@/features/orgs/projects/metrics/settings/components/PagerdutyFormSection';
import type { EventSeverity } from '@/features/orgs/projects/metrics/settings/components/PagerdutyFormSection/PagerdutyFormSectionTypes';
import { SlackFormSection } from '@/features/orgs/projects/metrics/settings/components/SlackFormSection';
import { WebhookFormSection } from '@/features/orgs/projects/metrics/settings/components/WebhookFormSection';
import type { HttpMethod } from '@/features/orgs/projects/metrics/settings/components/WebhookFormSection/WebhookFormSectionTypes';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  type ConfigConfigUpdateInput,
  GetObservabilitySettingsDocument,
  useGetObservabilitySettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { isNotEmptyValue } from '@/lib/utils';
import { removeTypename } from '@/utils/helpers';
import type { ContactPointsFormValues } from './ContactPointsSettingsTypes';
import { validationSchema } from './ContactPointsSettingsTypes';

export default function ContactPointsSettings() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, refetch: refetchProject } = useProject();
  const { openDialog } = useDialog();

  const { data, error } = useGetObservabilitySettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { emails, pagerduty, discord, slack, webhook } =
    data?.config?.observability?.grafana?.contacts || {};

  const form = useForm<ContactPointsFormValues>({
    defaultValues: {
      emails: [],
      discord: [],
      pagerduty: [],
      slack: [],
      webhook: [],
    },
    values: {
      emails: emails?.map((email) => ({ email })) || [],
      discord: discord || [],
      pagerduty:
        pagerduty?.map((elem) => ({
          ...elem,
          severity: elem.severity as EventSeverity,
        })) || [],
      slack:
        slack?.map((elem) => ({
          ...elem,
          mentionUsers: elem.mentionUsers.join(','),
          mentionGroups: elem.mentionGroups.join(','),
        })) || [],
      webhook:
        webhook?.map((elem) => ({
          ...elem,
          httpMethod: elem.httpMethod as HttpMethod,
        })) || [],
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetObservabilitySettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const getFormattedConfig = (values: ContactPointsFormValues) => {
    // Remove any __typename property from the values
    const sanitizedValues = removeTypename(values) as ContactPointsFormValues;
    const newEmails =
      sanitizedValues.emails?.map((email) => email.email) ?? null;
    const newPagerduty =
      isNotEmptyValue(sanitizedValues.pagerduty) &&
      sanitizedValues.pagerduty.length > 0
        ? sanitizedValues.pagerduty
        : null;
    const newDiscord =
      isNotEmptyValue(sanitizedValues.discord) &&
      sanitizedValues.discord.length > 0
        ? sanitizedValues.discord
        : null;

    const newSlack =
      isNotEmptyValue(sanitizedValues.slack) && sanitizedValues.slack.length > 0
        ? sanitizedValues.slack.map((elem) => ({
            ...elem,
            mentionUsers: (elem.mentionUsers ?? '').split(','),
            mentionGroups: (elem.mentionGroups ?? '').split(','),
          }))
        : null;

    const newWebhook =
      isNotEmptyValue(sanitizedValues.webhook) &&
      sanitizedValues.webhook.length > 0
        ? sanitizedValues.webhook
        : null;

    const config: ConfigConfigUpdateInput = {
      observability: {
        grafana: {
          contacts: {
            emails: newEmails,
            pagerduty: newPagerduty,
            discord: newDiscord,
            slack: newSlack,
            webhook: newWebhook,
          },
        },
      },
    };

    return config;
  };

  if (error) {
    throw error;
  }

  const handleSubmit = async (formValues: ContactPointsFormValues) => {
    const config = getFormattedConfig(formValues);

    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config,
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
        <SettingsCard className="gap-0">
          <SettingsCardHeader
            title="Contact Points"
            description="Define the contact points where your notifications will be sent."
          />

          <SettingsCardContent className={twMerge('my-2 px-0')}>
            <div className="border-t" />
            <EmailsFormSection />
            <div className="border-t" />
            <PagerdutyFormSection />
            <div className="border-t" />
            <DiscordFormSection />
            <div className="border-t" />
            <SlackFormSection />
            <div className="border-t" />
            <WebhookFormSection />
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/platform/cloud/metrics#configure-contact-points"
              title="Contact Points"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!form.formState.isDirty}
              loading={form.formState.isSubmitting}
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
