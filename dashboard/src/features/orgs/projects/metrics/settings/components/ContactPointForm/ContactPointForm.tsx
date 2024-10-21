import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ArrowsClockwise } from '@/components/ui/v2/icons/ArrowsClockwise';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Text } from '@/components/ui/v2/Text';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { validationSchema } from '@/features/orgs/projects/metrics/settings/components/ContactPointForm/ContactPointFormTypes';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { removeTypename } from '@/utils/helpers';
import {
  GetObservabilitySettingsDocument,
  useGetObservabilitySettingsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { EmailsFormSection } from './components/EmailsFormSection';
import type {
  ContactPointFormProps,
  ContactPointFormValues,
  IntegrationType,
} from './ContactPointFormTypes';

export default function ContactPointForm({
  initialData,
  onSubmit,
  onCancel,
  location,
}: ContactPointFormProps) {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { onDirtyStateChange, openDialog, closeDialog } = useDialog();
  const { project } = useProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetObservabilitySettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error, refetch } = useGetObservabilitySettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const initialEmails =
    data?.config?.observability?.grafana?.contacts?.emails || [];

  const [createServiceFormError, setCreateServiceFormError] =
    useState<Error | null>(null);

  const form = useForm<ContactPointFormValues>({
    defaultValues: initialData ?? {
      emails: [],
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    watch,
    register,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;

  const formValues = watch();

  const isDirty = Object.keys(dirtyFields).length > 0;

  const [integrationType, setIntegrationType] =
    useState<IntegrationType>('email');

  const handleIntegrationTypeChange = (value: IntegrationType) => {
    setIntegrationType(value);
  };

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  const getFormattedConfig = (values: ContactPointFormValues) => {
    // Remove any __typename property from the values
    const sanitizedValues = removeTypename(values) as ContactPointFormValues;

    return sanitizedValues;
  };

  const createOrUpdateContactPoint = async (values: ContactPointFormValues) => {
    console.log(values);

    const emails = values.emails ?? [];

    // Update service config
    await updateConfig({
      variables: {
        appId: project.id,
        config: {
          observability: {
            grafana: {
              contacts: {
                emails,
              },
            },
          },
        },
      },
    });

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
  };

  const handleSubmit = async (values: ContactPointFormValues) => {
    console.log('Submitting');
    await execPromiseWithErrorToast(
      async () => {
        await createOrUpdateContactPoint(values);
        onSubmit?.();
      },
      {
        loadingMessage: 'Adding the contact point...',
        successMessage: 'The contact point has been configured successfully.',
        errorMessage:
          'An error occurred while configuring the contact point. Please try again.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="grid grid-flow-row gap-4 px-6 pb-6"
      >
        <Box className="space-y-4 rounded border-1 p-4">
          <Box className="flex flex-row items-center space-x-2">
            <Text variant="h4" className="font-semibold">
              Integration
            </Text>
          </Box>

          <Tabs defaultValue="email">
            <TabsList>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="pagerduty">Pagerduty</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="slack">Slack</TabsTrigger>
              <TabsTrigger value="discord">Discord</TabsTrigger>
            </TabsList>
            <TabsContent value="email">
              <EmailsFormSection />
            </TabsContent>
            <TabsContent value="pagerduty">
              <p>Pagerduty</p>
            </TabsContent>
            <TabsContent value="webhooks">
              <p>Webhooks</p>
            </TabsContent>
            <TabsContent value="slack">
              <p>Slack</p>
            </TabsContent>
            <TabsContent value="discord">
              <p>Discord</p>
            </TabsContent>
          </Tabs>
        </Box>

        {createServiceFormError && (
          <Alert
            severity="error"
            className="grid grid-flow-col items-center justify-between px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {createServiceFormError.message}
            </span>

            <Button
              variant="borderless"
              color="error"
              size="small"
              onClick={() => {
                setCreateServiceFormError(null);
              }}
            >
              Clear
            </Button>
          </Alert>
        )}
        <div className="grid grid-flow-row gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              startIcon={
                initialData?.emails?.length > 0 ? (
                  <ArrowsClockwise />
                ) : (
                  <PlusIcon />
                )
              }
            >
              {initialData?.emails?.length > 0 ? 'Update' : 'Create'}
            </Button>
            <Button variant="outlined" color="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </Form>
    </FormProvider>
  );
}
