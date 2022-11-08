import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useSubmitState } from '@/hooks/useSubmitState';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { triggerToast } from '@/utils/toast';
import {
  refetchGetAppInjectedVariablesQuery,
  useUpdateApplicationMutation,
} from '@/utils/__generated__/graphql';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

export interface EditCustomUserJWTTokenData {
  customUserJWTToken: string;
}

export type JWTSecretModalState = 'SHOW' | 'EDIT';

export interface JWTSecretModalProps {
  close: () => void;
  data?: any;
  jwtSecret: string;
  initialModalState?: JWTSecretModalState;
}

export function EditJWTSecretModal({ close }) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { submitState, setSubmitState } = useSubmitState();

  const [updateApplication] = useUpdateApplicationMutation({
    refetchQueries: [
      refetchGetAppInjectedVariablesQuery({ id: currentApplication.id }),
    ],
  });

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<EditCustomUserJWTTokenData>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      customUserJWTToken: '',
    },
  });

  const handleEditJWTSecret = async (data: EditCustomUserJWTTokenData) => {
    setSubmitState({
      error: null,
      loading: false,
      fieldsWithError: [],
    });
    try {
      JSON.parse(data.customUserJWTToken);
    } catch (error) {
      setSubmitState({
        error: new Error('The custom JWT token should be valid json.'),
        loading: false,
        fieldsWithError: [],
      });
      return;
    }

    try {
      await updateApplication({
        variables: {
          appId: currentApplication.id,
          app: {
            hasuraGraphqlJwtSecret: data.customUserJWTToken,
          },
        },
      });
      triggerToast(
        `Successfully added custom JWT token to ${currentApplication.name}.`,
      );
      close();
    } catch (error) {
      triggerToast(
        `Error adding custom JWT token to ${currentApplication.name}`,
      );
      setSubmitState({ error, loading: false, fieldsWithError: [] });
    }
  };

  return (
    <form
      className="w-modal px-6 py-4"
      onSubmit={handleSubmit(handleEditJWTSecret)}
    >
      <div className="grid grid-flow-row gap-2">
        <div className="grid grid-flow-row text-left">
          <Text variant="h3" component="h2">
            Add Custom JWT Secret
          </Text>

          <Text variant="subtitle2">
            You can add your custom JWT key here. Hasura will use this key to
            validate the identity of your users.
          </Text>
        </div>

        {submitState.error && (
          <Alert severity="error">{submitState.error.message}</Alert>
        )}

        <Controller
          name="customUserJWTToken"
          control={control}
          rules={{
            required: true,
          }}
          render={({ field }) => (
            <Input
              {...field}
              placeholder="Paste your custom JWT token here..."
              componentsProps={{
                inputRoot: {
                  className: 'font-mono bg-header',
                },
              }}
              aria-label="Custom JWT token"
              type="text"
              value={field.value}
              onBlur={() =>
                setSubmitState({
                  error: null,
                  loading: false,
                  fieldsWithError: [],
                })
              }
              multiline
              rows={6}
              fullWidth
              hideEmptyHelperText
            />
          )}
        />

        <div className="grid grid-flow-row gap-2">
          <Button type="submit" loading={isSubmitting}>
            Save Changes
          </Button>

          <Button variant="outlined" color="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

export function ShowJWTTokenModal({ JWTKey, editJWTSecret }) {
  return (
    <div className="w-modal px-6 py-4">
      <div className="grid grid-flow-row gap-2">
        <div className="grid grid-flow-row text-left">
          <Text variant="h3" component="h2">
            Auth JWT Secret
          </Text>
          <Text variant="subtitle2">
            This is the key used for generating JWTs. It&apos;s HMAC-SHA-based
            and the same as configured in Hasura.
          </Text>
        </div>
        <div>
          <Input
            defaultValue={JWTKey}
            multiline
            disabled
            fullWidth
            hideEmptyHelperText
            rows={6}
            componentsProps={{
              inputRoot: { className: 'font-mono' },
            }}
          />
        </div>

        <div className="mx-auto max-w-sm text-center">
          <Text variant="subtitle2">
            Already using a third party auth service? <br />
            <button
              type="button"
              className="mt-0.5 ml-0.5 text-xs font-medium text-blue"
              onClick={() => {
                editJWTSecret();
              }}
            >
              Add your custom JWT token
            </button>
          </Text>
        </div>
      </div>
    </div>
  );
}

export function JWTSecretModal({ close, data, jwtSecret, initialModalState }) {
  const [jwtSecretModalState, setJwtSecretModalState] =
    useState<JWTSecretModalState>(initialModalState || 'SHOW');

  const editJWTSecret = () => {
    setJwtSecretModalState('EDIT');
  };

  if (jwtSecretModalState === 'EDIT') {
    return <EditJWTSecretModal close={close} />;
  }

  return (
    <ShowJWTTokenModal
      JWTKey={jwtSecret || data}
      editJWTSecret={editJWTSecret}
    />
  );
}
