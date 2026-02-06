import { CheckCircle2, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import Image from 'next/image';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Container } from '@/components/layout/Container';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';

// Mock data - replace with actual API call
const mockMetadataStatus = {
  inconsistent_objects: [],
  is_consistent: true,
};

export default function HasuraMetadataPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [reloadRemoteSchemas, setReloadRemoteSchemas] = useState(false);
  const [reloadDatabases, setReloadDatabases] = useState(false);
  const [metadataStatus, setMetadataStatus] = useState(mockMetadataStatus);
  const [lastReloadTime, setLastReloadTime] = useState<Date | null>(null);

  const handleReload = async () => {
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock response - in reality this would come from the API
    setMetadataStatus({
      inconsistent_objects: [],
      is_consistent: true,
    });
    setLastReloadTime(new Date());
    setIsLoading(false);
  };

  const hasInconsistencies =
    !metadataStatus.is_consistent ||
    metadataStatus.inconsistent_objects.length > 0;

  return (
    <Container>
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10">
            <Image
              src="/assets/hasuramodal.svg"
              width={48}
              height={48}
              alt="Hasura"
              className="opacity-90"
            />
          </div>
          <h1 className="font-semibold text-foreground text-lg tracking-tight">
            Hasura Metadata
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage and reload your Hasura metadata to keep your GraphQL schema
            in sync with your data sources.
          </p>
        </div>

        {/* Status Card */}
        <div className="mb-6 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasInconsistencies ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
                  <TriangleAlert className="h-4 w-4 text-destructive" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
              )}
              <div>
                <h3 className="font-medium text-foreground text-sm">
                  Metadata Status
                </h3>
                <p className="text-muted-foreground text-xs">
                  {lastReloadTime
                    ? `Last reloaded: ${lastReloadTime.toLocaleTimeString()}`
                    : 'Not yet reloaded this session'}
                </p>
              </div>
            </div>
            <Badge
              variant={hasInconsistencies ? 'destructive' : 'default'}
              className={
                !hasInconsistencies
                  ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                  : ''
              }
            >
              {hasInconsistencies ? 'Inconsistent' : 'Consistent'}
            </Badge>
          </div>

          {hasInconsistencies && (
            <Alert variant="destructive" className="mt-4">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Metadata Inconsistencies Detected</AlertTitle>
              <AlertDescription>
                Found {metadataStatus.inconsistent_objects.length} inconsistent
                object(s). Please review and fix the issues below.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Reload Section */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4 font-medium text-foreground text-sm">
            Reload Metadata
          </h3>

          <div className="space-y-4">
            {/* Reload Button */}
            <Button
              onClick={handleReload}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reloading Metadata...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Metadata
                </>
              )}
            </Button>

            {/* Options - Horizontal Layout */}
            <div className="flex flex-row flex-wrap gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="reload-remote-schemas"
                        checked={reloadRemoteSchemas}
                        onCheckedChange={(checked) =>
                          setReloadRemoteSchemas(checked as boolean)
                        }
                      />
                      <Label
                        htmlFor="reload-remote-schemas"
                        className="cursor-pointer font-normal text-muted-foreground text-xs"
                      >
                        Reload all remote schemas
                      </Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Refreshes the schema and metadata for all remote GraphQL
                      schemas connected to your Hasura instance.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="reload-databases"
                        checked={reloadDatabases}
                        onCheckedChange={(checked) =>
                          setReloadDatabases(checked as boolean)
                        }
                      />
                      <Label
                        htmlFor="reload-databases"
                        className="cursor-pointer font-normal text-muted-foreground text-xs"
                      >
                        Reload all databases
                      </Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Refreshes the schema and metadata for all connected
                      databases, including tables, views, and relationships.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <p className="text-center text-muted-foreground text-xs">
              Reloading metadata syncs your GraphQL schema with the current
              state of your data sources.
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}

HasuraMetadataPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout>{page}</OrgLayout>;
};
