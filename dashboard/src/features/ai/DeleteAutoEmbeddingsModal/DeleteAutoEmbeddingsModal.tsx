import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getHasuraAdminSecret } from '@/utils/env';
import { useDeleteGraphiteAutoEmbeddingsConfigurationMutation } from '@/utils/__generated__/graphite.graphql';
import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  type ApolloError,
} from '@apollo/client';
import { type AutoEmbeddingsConfiguration } from 'pages/[workspaceSlug]/[appSlug]/ai/auto-embeddings';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface DeleteAutoEmbeddingsModalProps {
  autoEmbeddingsConfiguration: AutoEmbeddingsConfiguration;
  onDelete?: () => Promise<any>;
  close: () => void;
}

export default function DeleteAutoEmbeddingsModal({
  autoEmbeddingsConfiguration,
  onDelete,
  close,
}: DeleteAutoEmbeddingsModalProps) {
  const [remove, setRemove] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);

  const { currentProject } = useCurrentWorkspaceAndProject();

  const serviceUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
    'graphql',
  );

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: serviceUrl,
      headers: {
        'x-hasura-admin-secret':
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : currentProject?.config?.hasura.adminSecret,
      },
    }),
  });

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

    await toast.promise(
      deleteAutoEmbeddingsConfig(),
      {
        loading: 'Deleting Auto-Embeddings Configuration...',
        success: `The Auto-Embeddings Configuration has been deleted successfully.`,
        error: (arg: ApolloError) => {
          // we need to get the internal error message from the GraphQL error
          const { internal } = arg.graphQLErrors[0]?.extensions || {};
          const { message } = (internal as Record<string, any>)?.error || {};

          // we use the default Apollo error message if we can't find the
          // internal error message
          return (
            message ||
            arg.message ||
            'An error occurred while deleting the Auto-Embeddings Configuration. Please try again.'
          );
        },
      },
      getToastStyleProps(),
    );
  }

  return (
    <Box className={twMerge('w-full rounded-lg p-6 text-left')}>
      <div className="grid grid-flow-row gap-1">
        <Text variant="h3" component="h2">
          Delete Auto-Embeddings Configuration{' '}
          {autoEmbeddingsConfiguration?.name}
        </Text>

        <Text variant="subtitle2">
          Are you sure you want to delete this Auto-Embeddings Configuration?
        </Text>

        <Text
          variant="subtitle2"
          className="font-bold"
          sx={{ color: (theme) => `${theme.palette.error.main} !important` }}
        >
          This cannot be undone.
        </Text>

        <Box className="my-4">
          <Checkbox
            id="accept-1"
            label={`I'm sure I want to delete ${autoEmbeddingsConfiguration?.name}`}
            className="py-2"
            checked={remove}
            onChange={(_event, checked) => setRemove(checked)}
            aria-label="Confirm Delete Auto-Embeddings Configuration"
          />
        </Box>

        <div className="grid grid-flow-row gap-2">
          <Button
            color="error"
            onClick={handleClick}
            disabled={!remove}
            loading={loadingRemove}
          >
            Delete Auto-Embeddings Configuration
          </Button>

          <Button variant="outlined" color="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Box>
  );
}
