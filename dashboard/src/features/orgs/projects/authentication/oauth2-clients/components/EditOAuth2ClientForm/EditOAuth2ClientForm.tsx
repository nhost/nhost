import { zodResolver } from '@hookform/resolvers/zod';
import bcrypt from 'bcryptjs';
import { format } from 'date-fns';
import { CopyIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormTextarea } from '@/components/form/FormTextarea';
import { Button } from '@/components/ui/v3/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import { Label } from '@/components/ui/v3/label';
import { Separator } from '@/components/ui/v3/separator';
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

const validationSchema = z.object({
  description: z.string().default(''),
  redirectUris: z.string().default(''),
});

type EditOAuth2ClientFormValues = z.infer<typeof validationSchema>;

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
    resolver: zodResolver(validationSchema),
  });

  const {
    formState: { isSubmitting, dirtyFields },
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
          <Label>Client ID</Label>
          <div className="flex items-center gap-1">
            <p className="truncate font-medium font-mono text-foreground text-sm">
              {oauth2Client.clientId}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Copy Client ID"
              onClick={() => copy(oauth2Client.clientId, 'Client ID')}
            >
              <CopyIcon className="h-4 w-4" />
            </Button>
          </div>

          <Label>Created At</Label>
          <p className="font-medium text-foreground">
            {format(new Date(oauth2Client.createdAt), 'yyyy-MM-dd HH:mm:ss')}
          </p>

          <Label>Updated At</Label>
          <p className="font-medium text-foreground">
            {format(new Date(oauth2Client.updatedAt), 'yyyy-MM-dd HH:mm:ss')}
          </p>
        </div>

        <FormInput
          control={form.control}
          name="description"
          label="Description"
          placeholder="Describe this OAuth2 client"
          autoComplete="off"
        />

        <FormTextarea
          control={form.control}
          name="redirectUris"
          label="Redirect URIs (one per line)"
          placeholder="https://example.com/callback"
          className="min-h-[80px]"
        />

        <div>
          <Label className="mb-2 block">Scopes</Label>
          <ScopePicker selected={selectedScopes} onChange={setSelectedScopes} />
        </div>

        <Separator />

        <div className="grid gap-2">
          <p className="font-medium text-foreground">Client Secret</p>
          <p className="text-muted-foreground text-sm">
            {isConfidential
              ? 'This client has a secret configured.'
              : 'This is a public client with no secret.'}
          </p>

          <InputGroup className="lg:w-1/2">
            <InputGroupInput
              readOnly
              value={pendingSecret ?? ''}
              placeholder={
                isConfidential ? '<secret hidden>' : '<no secret configured>'
              }
              className="font-mono text-sm"
            />
            {pendingSecret && (
              <InputGroupAddon align="inline-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Copy secret"
                  onClick={() => copy(pendingSecret, 'Client secret')}
                >
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </InputGroupAddon>
            )}
          </InputGroup>

          <div className="grid grid-flow-row items-center justify-start gap-1 pt-1">
            {pendingSecret && (
              <p className="text-muted-foreground text-xs">
                Copy this secret now. You will not be able to see it again.
              </p>
            )}
            <div className="grid grid-flow-col items-center justify-start gap-1">
              {isConfidential ? (
                <p className="text-muted-foreground text-xs">
                  Generating a new secret will invalidate the current one when
                  you save.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Generate a secret to make this a confidential client.
                </p>
              )}
              <Button
                onClick={handleGenerateSecret}
                className="h-auto px-1 py-0.5 text-xs"
                variant="link"
                type="button"
              >
                Generate a secret
              </Button>
            </div>
            {isConfidential && (
              <div className="grid grid-flow-col items-center justify-start gap-1">
                <Button
                  variant="link"
                  onClick={handleRemoveSecret}
                  type="button"
                  className="h-auto px-1 py-0.5 text-destructive text-xs"
                >
                  Remove secret (make public)
                </Button>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="grid grid-flow-row gap-2">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            Save Changes
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
