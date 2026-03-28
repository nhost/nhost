import { yupResolver } from '@hookform/resolvers/yup';
import bcrypt from 'bcryptjs';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Button } from '@/components/ui/v2/Button';
import { Divider } from '@/components/ui/v2/Divider';
import { IconButton } from '@/components/ui/v2/IconButton';
import { Input } from '@/components/ui/v2/Input';
import { InputAdornment } from '@/components/ui/v2/InputAdornment';
import { InputLabel } from '@/components/ui/v2/InputLabel';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Text } from '@/components/ui/v2/Text';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import ScopePicker from '@/features/orgs/projects/authentication/oauth2/ScopePicker';
import { generateClientSecret } from '@/features/orgs/projects/authentication/oauth2/utils';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { GetOAuth2ClientsQuery } from '@/generated/graphql';
import {
  GetOAuth2ClientsDocument,
  useUpdateOAuth2ClientMutation,
} from '@/generated/graphql';
import type { DialogFormProps } from '@/types/common';
import { copy } from '@/utils/copy';

type OAuth2Client = GetOAuth2ClientsQuery['authOauth2Clients'][number];

export interface EditOAuth2ClientFormProps extends DialogFormProps {
  client: OAuth2Client;
  onCancel?: VoidFunction;
  onSubmit?: () => Promise<unknown>;
}

const validationSchema = Yup.object({
  description: Yup.string().default(''),
  redirectUris: Yup.string().default(''),
});

type EditOAuth2ClientFormValues = Yup.InferType<typeof validationSchema>;

export default function EditOAuth2ClientForm({
  client: oauth2Client,
  onSubmit,
  onCancel,
  location,
}: EditOAuth2ClientFormProps) {
  const { onDirtyStateChange, openAlertDialog, closeDrawer } = useDialog();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(
    new Set(oauth2Client.scopes ?? []),
  );

  const [updateOAuth2Client] = useUpdateOAuth2ClientMutation({
    client: remoteProjectGQLClient,
    refetchQueries: [{ query: GetOAuth2ClientsDocument }],
  });

  const isConfidential = !!oauth2Client.clientSecretHash;
  const description =
    (oauth2Client.metadata?.description as string | undefined) ?? '';

  const form = useForm<EditOAuth2ClientFormValues>({
    defaultValues: {
      description,
      redirectUris: (oauth2Client.redirectUris ?? []).join('\n'),
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    formState: { errors, isSubmitting, dirtyFields },
  } = form;

  const initialScopes = useMemo(
    () => new Set(oauth2Client.scopes ?? []),
    [oauth2Client.scopes],
  );

  const scopesChanged = useMemo(() => {
    if (selectedScopes.size !== initialScopes.size) {
      return true;
    }
    for (const scope of selectedScopes) {
      if (!initialScopes.has(scope)) {
        return true;
      }
    }
    return false;
  }, [selectedScopes, initialScopes]);

  const isDirty =
    Object.keys(dirtyFields).length > 0 || scopesChanged || !!pendingSecret;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  function handleGenerateSecret() {
    const secret = generateClientSecret();
    setPendingSecret(secret);
    copy(secret, 'Client secret');
  }

  async function handleUpdate(values: EditOAuth2ClientFormValues) {
    const redirectUris = values.redirectUris
      ? values.redirectUris
          .split('\n')
          .map((uri) => uri.trim())
          .filter(Boolean)
      : [];

    const scopes = Array.from(selectedScopes);

    const changes: Record<string, unknown> = {
      redirectUris,
      scopes,
      metadata: {
        ...oauth2Client.metadata,
        description: values.description,
      },
    };

    if (pendingSecret) {
      const salt = bcrypt.genSaltSync(10);
      changes.clientSecretHash = bcrypt.hashSync(pendingSecret, salt);
    }

    await execPromiseWithErrorToast(
      async () => {
        await updateOAuth2Client({
          variables: {
            clientId: oauth2Client.clientId,
            changes,
          },
        });

        setPendingSecret(null);
        form.reset(values);
        await onSubmit?.();
      },
      {
        loadingMessage: 'Updating OAuth2 client...',
        successMessage: 'OAuth2 client has been updated successfully.',
        errorMessage: 'An error occurred while updating the OAuth2 client.',
      },
    );
  }

  function handleRemoveSecret() {
    openAlertDialog({
      title: 'Remove Client Secret',
      payload:
        'Are you sure you want to remove the client secret? This will convert the client to a public client.',
      props: {
        primaryButtonText: 'Remove Secret',
        primaryButtonColor: 'error',
        onPrimaryAction: async () => {
          await execPromiseWithErrorToast(
            async () => {
              await updateOAuth2Client({
                variables: {
                  clientId: oauth2Client.clientId,
                  changes: {
                    clientSecretHash: null,
                  },
                },
              });

              closeDrawer();
              await onSubmit?.();
            },
            {
              loadingMessage: 'Removing client secret...',
              successMessage:
                'Client secret removed. Client is now a public client.',
              errorMessage:
                'An error occurred while removing the client secret.',
            },
          );
        },
      },
    });
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleUpdate}
        className="grid grid-flow-row gap-6 px-6 pb-6"
      >
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-4">
          <InputLabel as="h3">Client ID</InputLabel>
          <div className="flex items-center gap-1">
            <Text className="truncate font-medium font-mono text-sm">
              {oauth2Client.clientId}
            </Text>
            <IconButton
              variant="borderless"
              color="secondary"
              aria-label="Copy Client ID"
              onClick={() => copy(oauth2Client.clientId, 'Client ID')}
            >
              <CopyIcon className="h-4 w-4" />
            </IconButton>
          </div>

          <InputLabel as="h3">Created At</InputLabel>
          <Text className="font-medium">
            {format(new Date(oauth2Client.createdAt), 'yyyy-MM-dd HH:mm:ss')}
          </Text>

          <InputLabel as="h3">Updated At</InputLabel>
          <Text className="font-medium">
            {format(new Date(oauth2Client.updatedAt), 'yyyy-MM-dd HH:mm:ss')}
          </Text>
        </div>

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
            {isConfidential
              ? 'This client has a secret configured.'
              : 'This is a public client with no secret.'}
          </Text>

          <Input
            value={pendingSecret ?? ''}
            placeholder={
              isConfidential ? '<secret hidden>' : '<no secret configured>'
            }
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
                    Copy this secret now. You will not be able to see it again.
                  </Text>
                )}
                <div className="grid grid-flow-col items-center justify-start gap-1">
                  {isConfidential ? (
                    <Text className="text-xs" color="secondary">
                      Generating a new secret will invalidate the current one
                      when you save.
                    </Text>
                  ) : (
                    <Text className="text-xs" color="secondary">
                      Generate a secret to make this a confidential client.
                    </Text>
                  )}
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
                {isConfidential && (
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
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            Save Changes
          </Button>
          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
