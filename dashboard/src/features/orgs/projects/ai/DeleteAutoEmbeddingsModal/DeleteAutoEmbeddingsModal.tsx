import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo, useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import type { AutoEmbeddingsConfiguration } from '@/features/orgs/projects/ai/auto-embeddings/types';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useDeleteGraphiteAutoEmbeddingsConfigurationMutation } from '@/generated/graphite';
import { isNotEmptyValue } from '@/lib/utils';

export interface DeleteAutoEmbeddingsModalProps {
  autoEmbeddingsConfiguration: AutoEmbeddingsConfiguration;
  onDelete?: () => Promise<unknown>;
  close: () => void;
}

export default function DeleteAutoEmbeddingsModal({
  autoEmbeddingsConfiguration,
  onDelete,
  close,
}: DeleteAutoEmbeddingsModalProps) {
  const [remove, setRemove] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);

  const { project } = useProject();

  const client = useMemo(() => {
    if (
      isNotEmptyValue(project?.subdomain) &&
      isNotEmptyValue(project?.region) &&
      isNotEmptyValue(project?.config?.hasura.adminSecret)
    ) {
      const serviceUrl = generateAppServiceUrl(
        project.subdomain,
        project.region,
        'graphql',
      );
      return new ApolloClient({
        cache: new InMemoryCache(),
        link: new HttpLink({
          uri: serviceUrl,
          headers: {
            'x-hasura-admin-secret': project.config.hasura.adminSecret,
          },
        }),
      });
    }

    return new ApolloClient({ cache: new InMemoryCache() });
  }, [
    project?.config?.hasura.adminSecret,
    project?.subdomain,
    project?.region,
  ]);

  const [deleteAutoEmbeddingsConfiguration] =
    useDeleteGraphiteAutoEmbeddingsConfigurationMutation({
      client,
    });

  const deleteAutoEmbeddingsConfig = async () => {
    await deleteAutoEmbeddingsConfiguration({
      variables: {
        id: autoEmbeddingsConfiguration.id,
      },
    });
    await onDelete?.();
    close();
  };

  async function handleClick() {
    setLoadingRemove(true);

    try {
      await execPromiseWithErrorToast(deleteAutoEmbeddingsConfig, {
        loadingMessage: 'Deleting Auto-Embeddings Configuration...',
        successMessage:
          'The Auto-Embeddings Configuration has been deleted successfully.',
        errorMessage:
          'An error occurred while deleting the Auto-Embeddings Configuration. Please try again.',
      });
    } finally {
      setLoadingRemove(false);
    }
  }

  return (
    <div className="w-full rounded-lg p-6 text-left">
      <div className="grid grid-flow-row gap-1">
        <h2 className="font-semibold text-lg">
          Delete Auto-Embeddings Configuration{' '}
          {autoEmbeddingsConfiguration.name}
        </h2>

        <p className="text-muted-foreground text-sm">
          Are you sure you want to delete this Auto-Embeddings Configuration?
        </p>

        <p className="font-bold text-destructive text-sm">
          This cannot be undone.
        </p>

        <div className="my-4">
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="accept-delete-auto-embeddings"
              checked={remove}
              onCheckedChange={(checked) => setRemove(checked === true)}
              aria-label="Confirm Delete Auto-Embeddings Configuration"
            />
            <Label
              htmlFor="accept-delete-auto-embeddings"
              className="cursor-pointer font-normal"
            >
              {`I'm sure I want to delete ${autoEmbeddingsConfiguration.name}`}
            </Label>
          </div>
        </div>

        <div className="grid grid-flow-row gap-2">
          <ButtonWithLoading
            variant="destructive"
            onClick={handleClick}
            disabled={!remove}
            loading={loadingRemove}
          >
            Delete Auto-Embeddings Configuration
          </ButtonWithLoading>

          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
