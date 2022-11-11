import { UnlockFeatureByUpgrading } from '@/components/applications/UnlockFeatureByUpgrading';
import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useSubmitState } from '@/hooks/useSubmitState';
import { Button, Toggle } from '@/ui';
import { Alert } from '@/ui/Alert';
import DelayedLoading from '@/ui/DelayedLoading';
import { Input } from '@/ui/Input';
import { Text } from '@/ui/Text';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import {
  useGetSmtpSettingsQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { useApolloClient } from '@apollo/client';
import { yupResolver } from '@hookform/resolvers/yup';
import type { ReactElement } from 'react';
import React, { useEffect, useState } from 'react';
import type { Control, FieldValues, Path } from 'react-hook-form';
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
} from 'react-hook-form';
import toast from 'react-hot-toast';
import * as yup from 'yup';

interface ValInputProps {
  title: string;
  type?: 'Input' | 'Toggle';
  inputType?: string;
  inputPlaceholder?: string;
  maxLength?: number;
  onChange?: (value: string) => void;
  id:
    | 'authSmtpSender'
    | 'authSmtpUser'
    | 'authSmtpHost'
    | 'authSmtpPort'
    | 'AuthSmtpSecure'
    | 'authSmtpPass'
    | 'AuthSmtpAuthMethod';
  control: Control<EditCustomSTMPSettingsFormData>;
  required?: boolean;
}

export function ControlledInput({
  name,
  control,
  children,
  required,
}: ControlledInputProps) {
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required,
      }}
      render={({ field }) => React.cloneElement(children, { ...field })}
    />
  );
}

function ValInput({
  title,
  type,
  inputType,
  onChange,
  inputPlaceholder,
  id,
  control,
  maxLength,
  required = true,
}: ValInputProps) {
  return (
    <div className="flex flex-row items-center px-2 py-5">
      <div className="flex w-full">
        <Text className="text-sm+ font-medium text-greyscaleDark">{title}</Text>
      </div>

      <div className="flex flex-col w-full">
        <div className="flex w-full ">
          {type === 'Input' && (
            <ControlledInput name={id} control={control} required={required}>
              <Input
                id={id}
                onChange={onChange}
                placeholder={inputPlaceholder || ''}
                type={inputType || 'text'}
                maxLength={maxLength || undefined}
                error={!!control.getFieldState(id)?.error}
                autoComplete="new-password"
              />
            </ControlledInput>
          )}
          {type === 'Toggle' && (
            <div className="py-1">
              <ControlledInput name={id} control={control}>
                <Toggle onChange={() => {}} />
              </ControlledInput>
            </div>
          )}
        </div>
        <div className="relative">
          {control.getFieldState(id)?.error && (
            <Text
              size="xtiny"
              color="red"
              className="absolute top-[0.1rem] font-medium"
            >
              {control.getFieldState(id).error.message}
            </Text>
          )}
        </div>
      </div>
    </div>
  );
}

export interface EditSenderDetailsFormData {
  senderName: string;
  senderAddress: string;
}

export interface EditCustomSTMPSettingsFormData {
  authSmtpUser: string;
  authSmtpHost: string;
  authSmtpPort: number;
  AuthSmtpSecure: boolean;
  authSmtpPass: string;
  // change to union type
  AuthSmtpAuthMethod: string;
  authSmtpSender: string;
}

function CustomSMTPSettingsForm({
  handleEditSMSSettings,
  loading,
  submitState,
}: any) {
  const { control } = useFormContext<EditCustomSTMPSettingsFormData>();
  const {
    handleSubmit,
    formState: { isSubmitting, errors, isValid },
  } = useFormContext<EditCustomSTMPSettingsFormData>();

  return (
    <form autoComplete="off" onSubmit={handleSubmit(handleEditSMSSettings)}>
      <div className="mt-6 border-t border-b divide-y-1">
        {/* <ValInput
          control={control}
          id="authSmtpUser"
          title="Sender Name"
          type="Input"
          inputPlaceholder="Username"
        /> */}

        <ValInput
          control={control}
          id="authSmtpSender"
          title="From Email"
          type="Input"
          inputPlaceholder="e.g. noreply@nhost.app"
        />
        <div className="flex flex-row items-center px-2 py-5 place-content-between">
          <div className="flex w-full">
            <Text className="text-sm+ font-medium text-greyscaleDark">
              SMTP Host and Port
            </Text>
          </div>

          <div className="w-full">
            <div className="flex flex-row w-full space-x-2">
              <div className="flex-auto">
                <Controller
                  name="authSmtpHost"
                  control={control}
                  rules={{
                    required: true,
                  }}
                  render={({ field }) => (
                    <Input
                      {...field}
                      required
                      value={field.value || ''}
                      id="authSmtpHost"
                      placeholder="e.g. smtp.sendgrid.net"
                      type="text"
                      onChange={(value: string) => {
                        field.onChange(value);
                      }}
                      error={!!errors[field.name]}
                    />
                  )}
                />
              </div>
              <div className="w-13">
                <Controller
                  name="authSmtpPort"
                  control={control}
                  rules={{
                    required: true,
                    pattern: {
                      value: /^[0-9]+$/,
                      message: 'The SMTP port must contain only numbers.',
                    },
                  }}
                  render={({ field }) => (
                    <Input
                      {...field}
                      required
                      value={field.value || ''}
                      placeholder="25"
                      type="text"
                      maxLength={4}
                      onChange={(value: string) => {
                        field.onChange(value);
                      }}
                      error={!!errors[field.name]}
                    />
                  )}
                />
              </div>
            </div>
            <div className="relative">
              {errors?.authSmtpHost?.message && !errors?.authSmtpPort?.message && (
                <Text
                  size="xtiny"
                  color="red"
                  className="absolute top-[0.1rem] font-medium"
                >
                  {errors?.authSmtpHost?.message}
                </Text>
              )}

              {errors?.authSmtpPort?.message && !errors?.authSmtpHost?.message && (
                <Text
                  size="xtiny"
                  color="red"
                  className="absolute top-[0.1rem] font-medium"
                >
                  {errors?.authSmtpPort?.message}
                </Text>
              )}
            </div>
          </div>
        </div>

        <ValInput
          control={control}
          id="authSmtpUser"
          title="SMTP User"
          type="Input"
          inputPlaceholder="Username"
        />
        <ValInput
          control={control}
          title="SMTP Password"
          id="authSmtpPass"
          inputPlaceholder="SMTP Password"
          type="Input"
          inputType="Password"
        />
        <ValInput
          title="Use SSL"
          type="Toggle"
          control={control}
          id="AuthSmtpSecure"
          required={false}
        />
        <ValInput
          control={control}
          id="AuthSmtpAuthMethod"
          title="SMTP Auth Method"
          type="Input"
          inputPlaceholder="LOGIN"
        />
      </div>
      {submitState.error && (
        <Alert className="mt-4" severity="error">
          {submitState.error.message}
        </Alert>
      )}
      <div className="flex mt-5 place-content-end">
        <div>
          <Button
            type="submit"
            variant="primary"
            className=""
            loading={loading}
            disabled={isSubmitting || !isValid}
          >
            Save Settings
          </Button>
        </div>
      </div>
    </form>
  );
}

function CustomSTMPSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const {
    data,
    loading: loadingSMTPQuery,
    error,
  } = useGetSmtpSettingsQuery({
    variables: {
      id: currentApplication.id,
    },
  });

  const [enableCustomSMTPSettings] = useState(true);
  const client = useApolloClient();
  const [updateApp, { loading: loadingUpdateAppMutation }] =
    useUpdateAppMutation();
  const { submitState, setSubmitState } = useSubmitState();
  const loading = submitState.loading || loadingUpdateAppMutation;
  let toastId: string | undefined;

  yup.setLocale({
    mixed: {
      default: 'field_invalid',
      required: 'This field is required.',
    },
    string: { email: 'This should be a valid email.' },
  });

  const schema = yup
    .object({
      AuthSmtpSecure: yup.bool(),
      authSmtpHost: yup
        .string()
        .matches(
          /((https?):\/\/)?(www.)?[a-z0-9]+(\.[a-z]{2,}){1,3}(#?\/?[a-zA-Z0-9#]+)*\/?(\?[a-zA-Z0-9-_]+=[a-zA-Z0-9-%]+&?)?$/,
          'The SMTP host must be a valid URL.',
        )
        .required(),
      authSmtpPort: yup
        .number()
        .typeError('The SMTP port should contain only numbers.')
        .required(),
      authSmtpUser: yup.string().required(),
      authSmtpPass: yup.string(),
      AuthSmtpAuthMethod: yup.string().required(),
      authSmtpSender: yup
        .string()
        .email('The sender address should be a valid email.')
        .required(),
    })
    .required();

  const form = useForm<EditCustomSTMPSettingsFormData>({
    reValidateMode: 'onChange',
    resolver: yupResolver(schema),
    defaultValues: {
      AuthSmtpSecure: data?.app.AuthSmtpSecure,
      authSmtpHost: data?.app.authSmtpHost,
      authSmtpPort: data?.app.authSmtpPort,
      authSmtpUser: data?.app.authSmtpUser,
      AuthSmtpAuthMethod: data?.app.AuthSmtpAuthMethod,
      authSmtpSender: data?.app.authSmtpSender,
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        AuthSmtpSecure: data.app.AuthSmtpSecure,
        authSmtpHost: data.app.authSmtpHost,
        authSmtpPort: data.app.authSmtpPort,
        authSmtpUser: data.app.authSmtpUser,
        AuthSmtpAuthMethod: data.app.AuthSmtpAuthMethod,
        authSmtpSender: data.app.authSmtpSender,
      });
    }
  }, [data, form]);

  if (loadingSMTPQuery) {
    return <DelayedLoading delay={500} />;
  }

  if (error) {
    throw error;
  }

  const handleEditSMTPSettings = async ({
    authSmtpSender,
    authSmtpHost,
    authSmtpPass,
    authSmtpPort,
    authSmtpUser,
    AuthSmtpAuthMethod,
    AuthSmtpSecure,
  }: EditCustomSTMPSettingsFormData) => {
    try {
      toastId = showLoadingToast('Updating SMTP settings...');

      const dataInputWithoutPass = {
        authSmtpSender,
        authSmtpUser,
        authSmtpHost,
        authSmtpPort,
        AuthSmtpSecure,
        AuthSmtpAuthMethod,
      };

      await updateApp({
        variables: {
          id: currentApplication.id,
          app: authSmtpPass
            ? { ...dataInputWithoutPass, authSmtpPass }
            : dataInputWithoutPass,
        },
      });
      await client.refetchQueries({ include: ['getSMTPSettings'] });
      toast.remove(toastId);
      triggerToast('SMTP settings updated successfully.');
    } catch (updateAppError) {
      if (toastId) {
        toast.remove(toastId);
      }

      setSubmitState({
        error: updateAppError,
        loading: false,
        fieldsWithError: [],
      });
    }
  };

  return (
    <FormProvider {...form}>
      <div className="flex flex-row place-content-between">
        <div className="flex w-[38rem] flex-col">
          <h2 className="text-lg font-medium text-greyscaleDark">
            SMTP Settings
          </h2>
        </div>
      </div>

      {submitState.error && (
        <Alert severity="error" className="mt-2">
          {submitState.error.message}
        </Alert>
      )}

      {enableCustomSMTPSettings && (
        <CustomSMTPSettingsForm
          handleEditSMSSettings={handleEditSMTPSettings}
          loading={loading}
          submitState={submitState}
        />
      )}
    </FormProvider>
  );
}

export type FieldPath<TFieldValues extends FieldValues> = Path<TFieldValues>;

interface ControlledInputProps {
  name: FieldPath<EditCustomSTMPSettingsFormData>;
  control: Control<EditCustomSTMPSettingsFormData, any>;
  children: any;
  required?: boolean;
}

export default function SMTPPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const isPlanFree = currentApplication.plan.isFree;

  return (
    <Container>
      {isPlanFree && (
        <UnlockFeatureByUpgrading message="Unlock custom SMTP Settings by upgrading your project to the Pro plan." />
      )}

      {!isPlanFree && <CustomSTMPSettings />}
    </Container>
  );
}

SMTPPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
