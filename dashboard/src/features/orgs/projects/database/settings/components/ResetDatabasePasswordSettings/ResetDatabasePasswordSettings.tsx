import { yupResolver } from '@hookform/resolvers/yup';
import { CopyIcon } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { InputGroupButton } from '@/components/ui/v3/input-group';
import { generateRandomDatabasePassword } from '@/features/orgs/projects/database/common/utils/generateRandomDatabasePassword';
import type { ResetDatabasePasswordFormValues } from '@/features/orgs/projects/database/settings/utils/resetDatabasePasswordValidationSchema';
import { resetDatabasePasswordValidationSchema } from '@/features/orgs/projects/database/settings/utils/resetDatabasePasswordValidationSchema';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useResetDatabasePasswordMutation } from '@/generated/graphql';
import { useLeaveConfirm } from '@/hooks/useLeaveConfirm';
import { useUserData } from '@/hooks/useUserData';
import { copy } from '@/utils/copy';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { triggerToast } from '@/utils/toast';

export default function ResetDatabasePasswordSettings() {
  const [resetPassword, { loading: resetPasswordLoading }] =
    useResetDatabasePasswordMutation();
  const user = useUserData();
  const { project } = useProject();
  const { openAlertDialog } = useDialog();

  const form = useForm<ResetDatabasePasswordFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      databasePassword: '',
    },
    mode: 'onSubmit',
    criteriaMode: 'all',
    shouldFocusError: true,
    resolver: yupResolver(resetDatabasePasswordValidationSchema),
  });

  const {
    setValue,
    getValues,
    formState: { dirtyFields, errors, isSubmitting },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;
  const hasDatabasePasswordError = Boolean(errors.databasePassword);

  useLeaveConfirm({ isDirty });

  function handleGenerateRandomPassword() {
    const newRandomDatabasePassword = generateRandomDatabasePassword();
    triggerToast(
      'Random database password was generated and copied to clipboard. Submit the form to save it.',
    );
    copy(newRandomDatabasePassword);
    setValue('databasePassword', newRandomDatabasePassword, {
      shouldDirty: true,
    });
  }

  async function handleChangeDatabasePassword(
    formValues: ResetDatabasePasswordFormValues,
  ) {
    try {
      await resetPassword({
        variables: {
          appId: project?.id,
          newPassword: formValues.databasePassword!,
        },
      });

      form.reset(formValues);

      triggerToast(
        `The database password for ${project?.name} has been updated successfully.`,
      );
    } catch (e) {
      triggerToast(
        `An error occurred while trying to update the database password for ${project?.name}`,
      );
      await discordAnnounce(
        `An error occurred while trying to update the database password: ${project?.name} (${user?.email}): ${e.message}`,
      );
    }
  }

  function handleSubmit(formValues: ResetDatabasePasswordFormValues) {
    openAlertDialog({
      title: 'Confirm Change',
      payload: 'Are you sure you want to change the database password?',
      props: {
        primaryButtonColor: 'error',
        primaryButtonText: 'Confirm',
        onPrimaryAction: () => handleChangeDatabasePassword(formValues),
      },
    });
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsCard className="border-destructive">
          <SettingsCardHeader
            title="Reset Password"
            description="This password will be used for accessing your database."
          />

          <SettingsCardContent className="pb-4">
            <FormInput
              control={form.control}
              name="databasePassword"
              type="password"
              autoComplete="new-password"
              aria-label="Database password"
              containerClassName="lg:w-1/2"
              helperText={
                <>
                  The root Postgres password for your database - it must be
                  strong and hard to guess.{' '}
                  <Button
                    onClick={handleGenerateRandomPassword}
                    className="h-auto px-1 py-0.5 text-xs underline underline-offset-2 hover:underline"
                    variant="link"
                  >
                    Generate a password
                  </Button>
                </>
              }
              addonEnd={
                <InputGroupButton
                  onClick={() => {
                    copy(
                      getValues('databasePassword') as string,
                      'Postgres password',
                    );
                  }}
                  aria-label="Copy password"
                  className={hasDatabasePasswordError ? 'invisible' : undefined}
                >
                  <CopyIcon className="h-4 w-4" />
                </InputGroupButton>
              }
            />
          </SettingsCardContent>

          <SettingsCardFooter>
            <ButtonWithLoading
              type="submit"
              variant="destructive"
              disabled={!isDirty}
              loading={isSubmitting || resetPasswordLoading}
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
