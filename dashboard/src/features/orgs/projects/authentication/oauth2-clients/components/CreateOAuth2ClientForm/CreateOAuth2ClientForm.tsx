import { yupResolver } from '@hookform/resolvers/yup';
import bcrypt from 'bcryptjs';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { Input } from '@/components/ui/v2/Input';
import { InputAdornment } from '@/components/ui/v2/InputAdornment';
import { InputLabel } from '@/components/ui/v2/InputLabel';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Text } from '@/components/ui/v2/Text';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import ScopePicker from '@/features/orgs/projects/authentication/oauth2/ScopePicker';
import { generateClientSecret } from '@/features/orgs/projects/authentication/oauth2/utils';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetOAuth2ClientsDocument,
  useInsertOAuth2ClientMutation,
} from '@/generated/graphql';
import type { DialogFormProps } from '@/types/common';
import { copy } from '@/utils/copy';

export interface CreateOAuth2ClientFormProps extends DialogFormProps {
  onCancel?: VoidFunction;
  onSubmit?: () => Promise<unknown>;
}

const DEFAULT_SCOPES = new Set(['openid', 'profile', 'email']);

const validationSchema = Yup.object({
  description: Yup.string().default(''),
  redirectUris: Yup.string().default(''),
});

type CreateOAuth2ClientFormValues = Yup.InferType<typeof validationSchema>;

export default function CreateOAuth2ClientForm({
  onSubmit,
  onCancel,
  location,
}: CreateOAuth2ClientFormProps) {
  const { onDirtyStateChange, closeDrawer } = useDialog();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const [pendingSecret, setPendingSecret] = useState<string | null>(
    generateClientSecret,
  );
  const [selectedScopes, setSelectedScopes] =
    useState<Set<string>>(DEFAULT_SCOPES);

  const [insertOAuth2Client] = useInsertOAuth2ClientMutation({
    client: remoteProjectGQLClient,
    refetchQueries: [{ query: GetOAuth2ClientsDocument }],
  });

  const form = useForm<CreateOAuth2ClientFormValues>({
    defaultValues: {
      description: '',
      redirectUris: '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  function handleGenerateSecret() {
    const secret = generateClientSecret();
    setPendingSecret(secret);
    copy(secret, 'Client secret');
  }

  function handleRemoveSecret() {
    setPendingSecret(null);
  }

  async function handleCreate(values: CreateOAuth2ClientFormValues) {
    const redirectUris = values.redirectUris
      ? values.redirectUris
          .split('\n')
          .map((uri) => uri.trim())
          .filter(Boolean)
      : [];

    const scopes = Array.from(selectedScopes);

    let clientSecretHash: string | undefined;
    if (pendingSecret) {
      const salt = bcrypt.genSaltSync(10);
      clientSecretHash = bcrypt.hashSync(pendingSecret, salt);
    }

    await execPromiseWithErrorToast(
      async () => {
        await insertOAuth2Client({
          variables: {
            object: {
              clientSecretHash,
              redirectUris,
              scopes,
              metadata: {
                description: values.description,
              },
            },
          },
        });

        await onSubmit?.();
        closeDrawer();
      },
      {
        loadingMessage: 'Creating OAuth2 client...',
        successMessage: 'OAuth2 client has been created successfully.',
        errorMessage: 'An error occurred while creating the OAuth2 client.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleCreate}
        className="grid grid-flow-row gap-6 px-6 pb-6"
      >
        <Input
          {...register('description')}
          id="description"
          label="Description"
          placeholder="Describe this OAuth2 client"
          hideEmptyHelperText
          error={!!errors.description}
          helperText={errors?.description?.message}
          fullWidth
          autoComplete="off"
        />

        <Input
          {...register('redirectUris')}
          id="redirectUris"
          label="Redirect URIs (one per line)"
          placeholder="https://example.com/callback"
          hideEmptyHelperText
          error={!!errors.redirectUris}
          helperText={errors?.redirectUris?.message}
          fullWidth
          autoComplete="off"
          multiline
          rows={3}
        />

        <div>
          <InputLabel className="mb-2">Scopes</InputLabel>
          <ScopePicker selected={selectedScopes} onChange={setSelectedScopes} />
        </div>

        <Divider />

        <div className="grid gap-2">
          <Text className="font-medium">Client Secret</Text>
          <Text className="text-sm" color="secondary">
            {pendingSecret
              ? 'A secret has been generated. The client will be created as confidential.'
              : 'No secret configured. The client will be created as public.'}
          </Text>

          <Input
            value={pendingSecret ?? ''}
            placeholder="<no secret configured>"
            fullWidth
            readOnly
            hideEmptyHelperText
            slotProps={{
              input: { className: 'lg:w-1/2' },
              inputRoot: { className: 'font-mono text-sm !pr-8' },
              helperText: { component: 'div' },
            }}
            helperText={
              <div className="grid grid-flow-row items-center justify-start gap-1 pt-1">
                {pendingSecret && (
                  <Text className="text-xs" color="secondary">
                    Copy this secret now. You will not be able to see it again
                    after creating the client.
                  </Text>
                )}
                <div className="grid grid-flow-col items-center justify-start gap-1">
                  <Button
                    onClick={handleGenerateSecret}
                    className="px-1 py-0.5 text-xs underline underline-offset-2 hover:underline"
                    variant="borderless"
                    color="secondary"
                    type="button"
                  >
                    Generate a secret
                  </Button>
                </div>
                {pendingSecret && (
                  <div className="grid grid-flow-col items-center justify-start gap-1">
                    <Button
                      variant="borderless"
                      color="error"
                      onClick={handleRemoveSecret}
                      type="button"
                      className="px-1 py-0.5 text-xs underline underline-offset-2 hover:underline"
                    >
                      Remove secret (make public)
                    </Button>
                  </div>
                )}
              </div>
            }
            endAdornment={
              <InputAdornment
                position="end"
                className={pendingSecret ? 'absolute right-2' : 'invisible'}
              >
                <Button
                  sx={{ minWidth: 0, padding: 0 }}
                  color="secondary"
                  onClick={() => {
                    if (pendingSecret) {
                      copy(pendingSecret, 'Client secret');
                    }
                  }}
                  variant="borderless"
                  aria-label="Copy secret"
                  type="button"
                >
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </InputAdornment>
            }
          />
        </div>

        <Divider />

        <div className="grid grid-flow-row gap-2">
          <Button type="submit" disabled={isSubmitting}>
            Create Client
          </Button>
          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
