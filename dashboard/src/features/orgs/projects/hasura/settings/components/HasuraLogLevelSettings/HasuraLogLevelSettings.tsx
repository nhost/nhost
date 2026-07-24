import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
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
import { HighlightedText } from '@/components/presentational/HighlightedText';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { SelectItem } from '@/components/ui/v3/select';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';

const validationSchema = Yup.object({
  logLevel: Yup.string().required().label('Log level'),
});

export type HasuraLogLevelFormValues = Yup.InferType<typeof validationSchema>;

const AVAILABLE_HASURA_LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

export default function HasuraLogLevelSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, refetch: refetchProject } = useProject();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { level } = data?.config?.hasura.logs || {};

  const form = useForm<HasuraLogLevelFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      logLevel: level || 'warn',
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && level) {
      form.reset({
        logLevel: level,
      });
    }
  }, [form, loading, level]);

  if (error) {
    throw error;
  }

  const { formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  async function handleSubmit(formValues: HasuraLogLevelFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          hasura: {
            logs: {
              level: formValues.logLevel || 'warn',
            },
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
        loadingMessage: 'Log level is being updated...',
        successMessage: 'Log level has been updated successfully.',
        errorMessage: 'An error occurred while trying to update log level.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsCard>
          <SettingsCardHeader
            title="Log Level"
            description={
              <>
                Setting a log-level will print all logs of priority greater than
                the set level. The log-level hierarchy is:{' '}
                <HighlightedText>
                  debug &rarr; info &rarr; warn &rarr; error
                </HighlightedText>
              </>
            }
          />

          <SettingsCardContent className="gap-x-4 gap-y-2 lg:grid-cols-5">
            <FormSelect
              name="logLevel"
              className="lg:col-span-2"
              control={form.control}
              placeholder="Select Log Level"
            >
              {AVAILABLE_HASURA_LOG_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </FormSelect>
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://hasura.io/docs/latest/deployment/logging/#logging-levels"
              title="Log Levels"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!isDirty}
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
