import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Button } from '@/components/ui/v2/Button';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Input } from '@/components/ui/v2/Input';
import { InputAdornment } from '@/components/ui/v2/InputAdornment';
import { generateRandomDatabasePassword } from '@/features/database/common/utils/generateRandomDatabasePassword';
import type { ResetDatabasePasswordFormValues } from '@/features/database/settings/utils/resetDatabasePasswordValidationSchema';
import { resetDatabasePasswordValidationSchema } from '@/features/database/settings/utils/resetDatabasePasswordValidationSchema';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useResetDatabasePasswordMutation } from '@/generated/graphql';
import { useLeaveConfirm } from '@/hooks/useLeaveConfirm';
import { copy } from '@/utils/copy';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { triggerToast } from '@/utils/toast';
import { yupResolver } from '@hookform/resolvers/yup';
import { alpha } from '@mui/system';
import { useUserData } from '@nhost/nextjs';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

export default function ResetDatabasePasswordSettings() {
  const [resetPassword, { loading: resetPasswordLoading }] =
    useResetDatabasePasswordMutation();
  const { maintenanceActive } = useUI();
  const user = useUserData();
  const { currentProject } = useCurrentWorkspaceAndProject();
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
    register,
    formState: { errors, dirtyFields, isSubmitting },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

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
          appId: currentProject.id,
          newPassword: formValues.databasePassword,
        },
      });

      form.reset(formValues);

      triggerToast(
        `The database password for ${currentProject.name} has been updated successfully.`,
      );
    } catch (e) {
      triggerToast(
        `An error occured while trying to update the database password for ${currentProject.name}`,
      );
      await discordAnnounce(
        `An error occurred while trying to update the database password: ${currentProject.name} (${user.email}): ${e.message}`,
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
        <SettingsContainer
          title="Reset Password"
          description="This password will be used for accessing your database."
          submitButtonText="Save"
          slotProps={{
            root: {
              sx: {
                borderColor: (theme) =>
                  isDirty
                    ? theme.palette.error.main
                    : alpha(theme.palette.error.main, 0.5),
                '@media (prefers-reduced-motion: no-preference)': {
                  transition: (theme) =>
                    theme.transitions.create('border-color'),
                },
              },
            },
            submitButton: {
              variant: isDirty ? 'contained' : 'outlined',
              color: isDirty ? 'error' : 'secondary',
              disabled: !isDirty || maintenanceActive,
              loading: isSubmitting || resetPasswordLoading,
            },
          }}
          className="grid grid-flow-row pb-4"
        >
          <Input
            {...register('databasePassword')}
            name="databasePassword"
            id="databasePassword"
            autoComplete="new-password"
            type="password"
            error={Boolean(errors?.databasePassword)}
            fullWidth
            hideEmptyHelperText
            slotProps={{
              input: { className: 'lg:w-1/2' },
              inputRoot: { className: '!pr-8' },
              helperText: { component: 'div' },
            }}
            helperText={
              <div className="grid grid-flow-row items-center justify-start gap-1 pt-1">
                {errors?.databasePassword?.message}
                <div className="grid grid-flow-col items-center justify-start gap-1">
                  The root Postgres password for your database - it must be
                  strong and hard to guess.
                  <Button
                    onClick={handleGenerateRandomPassword}
                    className="px-1 py-0.5 text-xs underline underline-offset-2 hover:underline"
                    variant="borderless"
                    color="secondary"
                  >
                    Generate a password
                  </Button>
                </div>
              </div>
            }
            endAdornment={
              <InputAdornment
                position="end"
                className={twMerge(
                  'absolute right-2',
                  Boolean(errors?.databasePassword) && 'invisible',
                )}
              >
                <Button
                  sx={{ minWidth: 0, padding: 0 }}
                  color="secondary"
                  onClick={() => {
                    copy(getValues('databasePassword'), 'Postgres password');
                  }}
                  variant="borderless"
                  aria-label="Copy password"
                >
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </InputAdornment>
            }
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
