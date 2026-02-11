import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useReloadMetadataMutation } from '@/features/orgs/projects/graphql/metadata/hooks/useReloadMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export default function ReloadMetadataCard() {
  const [reloadRemoteSchemas, setReloadRemoteSchemas] = useState(false);
  const [reloadDatabases, setReloadDatabases] = useState(false);

  const { isPending: isReloading, mutateAsync: reloadMetadata } =
    useReloadMetadataMutation();

  const handleReload = async () => {
    await execPromiseWithErrorToast(
      async () => {
        const result = await reloadMetadata({
          args: {
            reload_remote_schema: reloadRemoteSchemas,
            reload_sources: reloadDatabases,
          },
        });

        if (!result.is_consistent) {
          throw new Error(
            'Metadata was reloaded but inconsistencies were detected.',
          );
        }
      },
      {
        loadingMessage: 'Reloading metadata...',
        successMessage: 'Metadata reloaded successfully.',
        errorMessage: 'Failed to reload metadata.',
      },
    );
  };

  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-paper p-4">
      <h3 className="mb-4 font-medium text-foreground text-lg">
        Reload Metadata
      </h3>

      <div className="space-y-4">
        <ButtonWithLoading
          className="flex gap-1"
          onClick={handleReload}
          loading={isReloading}
          disabled={isReloading}
        >
          {!isReloading && <RefreshCw className="size-4" />}
          Reload Metadata
        </ButtonWithLoading>

        <div className="flex flex-row flex-wrap gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reload-remote-schemas"
                  checked={reloadRemoteSchemas}
                  onCheckedChange={(checked) =>
                    setReloadRemoteSchemas(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="reload-remote-schemas"
                  className="cursor-pointer font-normal text-muted-foreground"
                >
                  Reload all remote schemas
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="max-w-xs text-sm">
                Refreshes the schema and metadata for all remote GraphQL schemas
                connected to your instance.
              </p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reload-databases"
                  checked={reloadDatabases}
                  onCheckedChange={(checked) =>
                    setReloadDatabases(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="reload-databases"
                  className="cursor-pointer font-normal text-muted-foreground"
                >
                  Reload all databases
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="max-w-xs text-sm">
                Check this if you have inconsistent databases. This will refresh
                the schema and metadata for all connected databases, including
                tables, views, and relationships.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        <p className="max-w-prose text-pretty text-muted-foreground text-sm">
          Reloading metadata syncs your GraphQL schema with the current state of
          your data sources.
        </p>
      </div>
    </div>
  );
}
