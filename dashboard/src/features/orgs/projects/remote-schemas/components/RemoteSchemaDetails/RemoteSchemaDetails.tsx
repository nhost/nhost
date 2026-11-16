import { InfoIcon, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/router';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Input } from '@/components/ui/v3/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
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
      <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 px-4 py-4">
        <div>
          <h3 className="pb-2 font-medium text-lg">Remote Schema</h3>
          <p className="font-semibold text-sm+">{remoteSchema.name}</p>
        </div>
        {showComment && (
          <div>
            <h3 className="pb-2 font-medium text-lg">Comment</h3>
            <p className="text-muted-foreground text-sm+">
              {remoteSchema.comment}
            </p>
          </div>
        )}
        <div className="space-y-2">
          <div className="flex flex-row items-center space-x-2">
            <p className="text-sm+">
              {'url' in remoteSchema.definition
                ? 'GraphQL Service URL'
                : 'GraphQL Service URL (from environment)'}
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Info"
                  className="flex items-center"
                >
                  <InfoIcon className="h-4 w-4 text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                The URL of the GraphQL service to be used as a remote schema.
              </TooltipContent>
            </Tooltip>
          </div>
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
              readOnly
              disabled
              className="w-full"
              wrapperClassName="w-full"
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
        </div>
        {remoteSchema.definition.headers &&
          remoteSchema.definition.headers.length > 0 && (
            <RemoteSchemaHeadersTable
              headers={remoteSchema.definition.headers}
            />
          )}
        <div className="flex flex-row items-center space-x-2">
          <p className="text-sm+">Forward all headers from client:</p>
          <p className="font-semibold text-muted-foreground text-sm+">
            {remoteSchema.definition.forward_client_headers
              ? 'Enabled'
              : 'Disabled'}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Info"
                className="flex items-center"
              >
                <InfoIcon className="h-4 w-4 text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Toggle forwarding headers sent by the client app in the request to
              your remote GraphQL server
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-row items-center space-x-2">
          <p className="text-sm+">GraphQL Server Timeout:</p>
          <p className="font-semibold text-muted-foreground text-sm+">
            {remoteSchema.definition.timeout_seconds} seconds
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Info"
                className="flex items-center"
              >
                <InfoIcon className="h-4 w-4 text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Configure timeout for your remote GraphQL server. Defaults to 60
              seconds.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <RemoteSchemaPreview name={remoteSchema.name} />
    </div>
  );
}
