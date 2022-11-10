import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import {
  useResetPostgresPasswordMutation,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Text } from '@/ui';
import Button from '@/ui/v2/Button';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import { copy } from '@/utils/copy';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { generateRandomPassword, schema } from '@/utils/generateRandomPassword';
import { triggerToast } from '@/utils/toast';
import { useUserData } from '@nhost/react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

export interface ResetDatabasePasswordFormProps {
  /**
   * The new password to set for the database.
   */
  newDatabasePassword: string;
}

export default function ResetDatabasePasswordForm() {
  const [passwordError, setPasswordError] = useState('');
  const [updateApplication] = useUpdateApplicationMutation();

  const form = useForm<ResetDatabasePasswordFormProps>({
    reValidateMode: 'onChange',
    defaultValues: {
      newDatabasePassword: generateRandomPassword(),
    },
  });

  const { setValue, getValues, register } = form;

  const { closeAlertDialog } = useDialog();
  const [resetPostgresPasswordMutation, { loading }] =
    useResetPostgresPasswordMutation();
  const user = useUserData();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const handleGenerateRandomPassword = () => {
    const newRandomDatabasePassword = generateRandomPassword();
    setPasswordError('');
    triggerToast('New random database password generated.');
    setValue('newDatabasePassword', newRandomDatabasePassword);
  };

  const handleChangeDatabasePassword = async (
    data: ResetDatabasePasswordFormProps,
  ) => {
    try {
      await resetPostgresPasswordMutation({
        variables: {
          appID: currentApplication.id,
          newPassword: data.newDatabasePassword,
        },
      });
      await updateApplication({
        variables: {
          appId: currentApplication.id,
          app: {
            postgresPassword: data.newDatabasePassword,
          },
        },
      });
      closeAlertDialog();
      triggerToast(`${currentApplication.name} Database Password changed.`);
    } catch (e) {
      triggerToast(
        `Error trying to change database password for ${currentApplication.name}`,
      );
      await discordAnnounce(
        `Error trying to change database password: ${currentApplication.name} (${user.email}): ${e.message}`,
      );
    }
  };

  return (
    <FormProvider {...form}>
      <Form className="mx-0.5" onSubmit={handleChangeDatabasePassword}>
        <Input
          {...register('newDatabasePassword')}
          name="newDatabasePassword"
          id="newDatabasePassword"
          autoComplete="new-password"
          type="password"
          error={Boolean(passwordError)}
          helperText={
            <>
              {passwordError && <div className="pb-2">{passwordError}</div>}
              <Text className="font-normal" size="tiny" color="greyscaleDark">
                The root postgres password for your database - it must be strong
                and hard to guess.{' '}
                <Button
                  onClick={handleGenerateRandomPassword}
                  className="contents text-xs "
                >
                  <span className="ml-1 font-medium text-greyscaleDark underline underline-offset-2">
                    Generate a password
                  </span>
                </Button>
              </Text>
            </>
          }
          endAdornment={
            <InputAdornment position="end" className="absolute right-2">
              <Button
                sx={{ minWidth: 0, padding: 0 }}
                color="secondary"
                onClick={() => {
                  copy(getValues('newDatabasePassword'), 'Postgres password');
                }}
                variant="borderless"
                aria-label="Copy your newly randomly generated password to the clipboard."
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </InputAdornment>
          }
          onChange={async (e) => {
            if (e.target.value.length === 0) {
              setValue('newDatabasePassword', e.target.value);

              setPasswordError('Please enter a password');
              return;
            }
            setValue('newDatabasePassword', e.target.value);
            setPasswordError('');
            try {
              await schema.validate({
                'Database Password': e.target.value,
              });
              setPasswordError('');
            } catch (validationError) {
              setPasswordError(validationError.message);
            }
          }}
          fullWidth
        />

        <div className="mt-6 grid grid-flow-col place-content-between py-2">
          <Button
            color="secondary"
            variant="borderless"
            onClick={closeAlertDialog}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            type="submit"
            disabled={Boolean(passwordError)}
            loading={loading}
          >
            Reset Database Password
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
