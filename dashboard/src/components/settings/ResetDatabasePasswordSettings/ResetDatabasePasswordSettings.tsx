import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import {
  useResetPostgresPasswordMutation,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import { copy } from '@/utils/copy';
import { discordAnnounce } from '@/utils/discordAnnounce';
import generateRandomDatabasePassword from '@/utils/settings/generateRandomDatabasePassword';
import { resetDatabasePasswordValidationSchema } from '@/utils/settings/resetDatabasePasswordValidationSchema';
import { triggerToast } from '@/utils/toast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useUserData } from '@nhost/nextjs';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

export interface ResetDatabasePasswordFormValues {
  /**
   * The new password to set for the database.
   */
  databasePassword: string;
}

export default function ResetDatabasePasswordSettings() {
  const [updateApplication] = useUpdateApplicationMutation();

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
    formState: { errors },
  } = form;

  const [resetPostgresPasswordMutation, { loading }] =
    useResetPostgresPasswordMutation();
  const user = useUserData();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const handleGenerateRandomPassword = () => {
    const newRandomDatabasePassword = generateRandomDatabasePassword();
    triggerToast('New random database password generated.');
    setValue('databasePassword', newRandomDatabasePassword);
  };

  const handleChangeDatabasePassword = async (
    values: ResetDatabasePasswordFormValues,
  ) => {
    try {
      await resetPostgresPasswordMutation({
        variables: {
          appID: currentApplication.id,
          newPassword: values.databasePassword,
        },
      });
      await updateApplication({
        variables: {
          appId: currentApplication.id,
          app: {
            postgresPassword: values.databasePassword,
          },
        },
      });

      form.reset(values);

      triggerToast(
        `The database password for ${currentApplication.name} has been updated successfully.`,
      );
    } catch (e) {
      triggerToast(
        `An error occured while trying to update the database password for ${currentApplication.name}`,
      );
      await discordAnnounce(
        `An error occurred while trying to update the database password: ${currentApplication.name} (${user.email}): ${e.message}`,
      );
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleChangeDatabasePassword}>
        <SettingsContainer
          title="Reset Password"
          description="This password is used for accessing your database."
          submitButtonText="Reset"
          rootClassName="border-[#F87171]"
          primaryActionButtonProps={{
            variant: 'contained',
            color: 'error',
            disabled: Boolean(errors?.databasePassword),
            loading,
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
