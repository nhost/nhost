import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/router';
import { InlineCode } from '@/components/presentational/InlineCode';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { RemoteSchemaEmptyState } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaEmptyState';
import { RemoteSchemaHeadersTable } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaHeadersTable';
import { RemoteSchemaPreview } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaPreview';
import useGetRemoteSchemas from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas/useGetRemoteSchemas';
import { useReloadRemoteSchemaMutation } from '@/features/orgs/projects/remote-schemas/hooks/useReloadRemoteSchemaMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isNotEmptyValue } from '@/lib/utils';

export default function RemoteSchemaDetails() {
  const { mutateAsync: reloadRemoteSchema, isPending: isReloading } =
    useReloadRemoteSchemaMutation();

  const router = useRouter();

  const { remoteSchemaSlug } = router.query;

  const { data: remoteSchemas, status } = useGetRemoteSchemas();

  const remoteSchema = remoteSchemas?.find(
    (schema) => schema.name === remoteSchemaSlug,
  );

  if (status === 'loading' || !remoteSchema) {
    return (
      <RemoteSchemaEmptyState
        title="Remote schema not found"
        description={
          <span>
            Remote schema{' '}
            <InlineCode className="bg-opacity-80 px-1.5 text-sm">
              {remoteSchemaSlug}
            </InlineCode>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  const showComment = isNotEmptyValue(remoteSchema?.comment);

  const handleSchemaReload = async () => {
    await execPromiseWithErrorToast(
      async () => {
        await reloadRemoteSchema({
          args: {
            name: remoteSchema.name,
          },
        });
      },
      {
        loadingMessage: 'Reloading remote schema...',
        successMessage: 'Remote schema reloaded successfully.',
        errorMessage: 'Failed to reload remote schema',
      },
    );
  };

  return (
    <div className="space-y-6 p-4">
      <Box className="grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 px-4 py-4">
        <div>
          <Text variant="h3" className="pb-2">
            Remote Schema
          </Text>
          <Text className="font-semibold">{remoteSchema.name}</Text>
        </div>
        {showComment && (
          <div>
            <Text variant="h3" className="pb-2">
              Comment
            </Text>
            <Text color="secondary">{remoteSchema.comment}</Text>
          </div>
        )}
        <Box className="space-y-2">
          <Box className="flex flex-row items-center space-x-2">
            <Text>
              {'url' in remoteSchema.definition
                ? 'GraphQL Service URL'
                : 'GraphQL Service URL (from environment)'}
            </Text>
            <Tooltip title="The URL of the GraphQL service to be used as a remote schema.">
              <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
            </Tooltip>
          </Box>
          <div className="flex flex-row items-center gap-3">
            <Input
              value={
                'url' in remoteSchema.definition
                  ? remoteSchema.definition.url
                  : remoteSchema.definition.url_from_env
              }
              placeholder={
                'url' in remoteSchema.definition
                  ? 'https://graphql-service.example.com or {{ENV_VAR}}/endpoint_url'
                  : 'GRAPHQL_ENDPOINT_URL'
              }
              disabled
              fullWidth
              className="w-full"
            />
            <Button
              className="flex gap-1"
              onClick={handleSchemaReload}
              loading={isReloading}
              disabled={isReloading}
            >
              {!isReloading && <RefreshCw className="h-4 w-4" />}
              Reload
            </Button>
          </div>
        </Box>
        {remoteSchema.definition.headers &&
          remoteSchema.definition.headers.length > 0 && (
            <RemoteSchemaHeadersTable
              headers={remoteSchema.definition.headers}
            />
          )}
        <div className="flex flex-row items-center space-x-2">
          <Text>Forward all headers from client:</Text>
          <Text color="secondary" className="font-semibold">
            {remoteSchema.definition.forward_client_headers
              ? 'Enabled'
              : 'Disabled'}
          </Text>
          <Tooltip title="Toggle forwarding headers sent by the client app in the request to your remote GraphQL server">
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </div>
        <div className="flex flex-row items-center space-x-2">
          <Text>GraphQL Server Timeout:</Text>
          <Text color="secondary" className="font-semibold">
            {remoteSchema.definition.timeout_seconds} seconds
          </Text>
          <Tooltip title="Configure timeout for your remote GraphQL server. Defaults to 60 seconds.">
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </div>
      </Box>
      <RemoteSchemaPreview name={remoteSchema.name} />
    </div>
  );
}
