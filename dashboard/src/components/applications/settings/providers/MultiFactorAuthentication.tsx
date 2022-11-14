import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useFormSaver } from '@/hooks/useFormSaver';
import { FormSaver, Toggle } from '@/ui';
import { Alert } from '@/ui/Alert';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { showLoadingToast, triggerToast } from '@/utils/toast';
import {
  useGetAuthSettingsQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { useApolloClient } from '@apollo/client';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

export function MultiFactorAuthentication() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();
  const [OTPIssuer, setOTPIssuer] = useState('');
  const client = useApolloClient();
  const { showFormSaver, setShowFormSaver, submitState, setSubmitState } =
    useFormSaver();

  const toastId = useRef<string>();

  const { loading, data, error } = useGetAuthSettingsQuery({
    variables: {
      id: currentApplication.id,
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    if (!data.app.authMfaTotpIssuer) {
      return;
    }

    setOTPIssuer(data.app.authMfaTotpIssuer);
  }, [data]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={500}
        label="Loading settings..."
        className="mx-auto"
      />
    );
  }

  if (error) {
    throw error;
  }

  async function handleSaveForm() {
    setSubmitState({
      loading: true,
      error: null,
      fieldsWithError: [],
    });
    try {
      await updateApp({
        variables: {
          id: currentApplication.id,
          app: {
            authMfaTotpIssuer: OTPIssuer,
          },
        },
      });
      await client.refetchQueries({ include: ['getAuthSettings'] });
      setSubmitState({
        loading: false,
        error: null,
        fieldsWithError: [],
      });
      setShowFormSaver(false);
      triggerToast('All changes saved');
    } catch (updateError) {
      if (updateError instanceof Error) {
        triggerToast(updateError.message);
      }

      setSubmitState({
        loading: false,
        error: updateError,
        fieldsWithError: ['OTPIssuer'],
      });
    }
  }

  async function handleToggleMFA() {
    try {
      toastId.current = showLoadingToast('Saving changes...');
      await updateApp({
        variables: {
          id: currentApplication.id,
          app: {
            authMfaEnabled: !data.app.authMfaEnabled,
          },
        },
      });
      await client.refetchQueries({ include: ['getAuthSettings'] });

      if (toastId?.current) {
        toast.remove(toastId.current);
      }

      triggerToast(
        `Multi-Factor Authentication ${
          data.app.authMfaEnabled ? `Disabled` : `Enabled`
        } for ${currentApplication.name}`,
      );
    } catch (updateError) {
      if (toastId?.current) {
        toast.remove(toastId.current);
      }

      if (updateError instanceof Error) {
        triggerToast(updateError.message);
      }

      setSubmitState({
        loading: false,
        error: updateError,
        fieldsWithError: ['authMfaEnabled'],
      });
    }
  }

  return (
    <div className="grid w-full grid-flow-row gap-4">
      {showFormSaver && (
        <FormSaver
          show={showFormSaver}
          onCancel={() => {
            setShowFormSaver(false);
          }}
          onSave={handleSaveForm}
          loading={submitState.loading}
        />
      )}

      <div className="flex flex-row place-content-between">
        <div className="grid grid-flow-row gap-1.5">
          <Text variant="h3" component="h2">
            Multi-Factor Authentication
          </Text>
          <Text>Enable users to use multi-factor authentication (MFA).</Text>
        </div>

        <div className="mr-2 flex flex-row">
          <Toggle
            checked={data.app.authMfaEnabled}
            onChange={handleToggleMFA}
          />
        </div>
      </div>

      {submitState.error && (
        <Alert severity="error">{submitState.error.message}</Alert>
      )}

      {data.app.authMfaEnabled && (
        <div className="border-t border-b border-gray-200 py-4">
          <Input
            id="otpIssuer"
            label="Name of the One Time Password (OTP) issuer"
            onChange={(e) => {
              setShowFormSaver(true);
              setOTPIssuer(e.target.value);
            }}
            variant="inline"
            value={OTPIssuer}
            error={submitState.fieldsWithError?.includes('OTPIssuer')}
            placeholder={currentApplication.name}
            fullWidth
            hideEmptyHelperText
            inlineInputProportion="50%"
            componentsProps={{
              label: { className: 'text-sm+' },
            }}
          />
        </div>
      )}
    </div>
  );
}

export default MultiFactorAuthentication;
