import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { RemoteSchemaHeadersTable } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaHeadersTable';
import { RemoteSchemaPreview } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaPreview';
import { useReloadRemoteSchemaMutation } from '@/features/orgs/projects/remote-schemas/hooks/useReloadRemoteSchemaMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isNotEmptyValue } from '@/lib/utils';
import type { RemoteSchemaInfo } from '@/utils/hasura-api/generated/schemas';
import { RefreshCw } from 'lucide-react';

export interface RemoteSchemaDetailsProps {
  remoteSchema: RemoteSchemaInfo;
}

export default function RemoteSchemaDetails({
  remoteSchema,
}: RemoteSchemaDetailsProps) {
  const showComment = isNotEmptyValue(remoteSchema?.comment);

  const { mutateAsync: reloadRemoteSchema, isLoading: isReloading } =
    useReloadRemoteSchemaMutation();

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
        successMessage: 'Remote schema reloaded successfully!',
        errorMessage: 'Failed to reload remote schema',
      },
    );
  };

  return (
    <div className="space-y-6 p-4">
      <Box className="grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 px-4 py-4">
        <h2 className="text-lg font-semibold">{remoteSchema.name}</h2>
        {!showComment && (
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
            <Tooltip title="The URL of the GraphQL service to be used as a remote schemaEnvironment variables and secrets are available using the {{VARIABLE}} tag. Environment variable templating is available for this field. Example: https://{{ENV_VAR}}/endpoint_url.">
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
        {remoteSchema.definition.headers?.length > 0 && (
          <RemoteSchemaHeadersTable headers={remoteSchema.definition.headers} />
        )}
      </Box>

      {/* Schema Preview Section */}
      <RemoteSchemaPreview name={remoteSchema.name} />

      {/* Debug JSON - can be removed later */}
      <Box className="rounded-lg border-1 px-4 py-4">
        <Text variant="h3" className="pb-2">
          Debug: Remote Schema Data
        </Text>
        <pre className="overflow-auto rounded bg-muted p-2 text-xs">
          {JSON.stringify(remoteSchema, null, 2)}
        </pre>
      </Box>
    </div>
  );
}
