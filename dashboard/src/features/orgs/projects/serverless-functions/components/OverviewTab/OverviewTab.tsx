import { subMinutes } from 'date-fns';
import {
  ChevronRight,
  Clock,
  Cpu,
  GitCommit,
  Globe,
  ScrollText,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { Badge } from '@/components/ui/v3/badge';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { LogsBody } from '@/features/orgs/projects/logs/components/LogsBody';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';
import { cn } from '@/lib/utils';
import {
  type GetProjectLogsQuery,
  useGetFunctionsLogsQuery,
} from '@/utils/__generated__/graphql';
import { splitGraphqlClient } from '@/utils/splitGraphqlClient';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function MetadataCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 p-4 dark:border-gray-700',
        className,
      )}
    >
      <h3 className="mb-3 flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="font-mono text-gray-900 dark:text-gray-100">
        {value}
      </span>
    </div>
  );
}

function RecentLogsCard({
  fn,
  onViewAll,
}: {
  fn: NhostFunction;
  onViewAll: () => void;
}) {
  const { project } = useProject();

  const { from, to } = useMemo(() => {
    const now = new Date();
    return {
      from: subMinutes(now, 15).toISOString(),
      to: now.toISOString(),
    };
  }, []);

  const { data, loading, error } = useGetFunctionsLogsQuery({
    variables: {
      appID: project?.id,
      from,
      to,
      path: fn.route,
    },
    client: splitGraphqlClient,
    skip: !project?.id,
  });

  const logsData = useMemo(() => {
    if (!data) {
      return undefined;
    }
    return { logs: data.getFunctionsLogs } as unknown as GetProjectLogsQuery;
  }, [data]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 pt-4">
        <h3 className="flex items-center gap-2 text-muted-foreground text-sm">
          <ScrollText className="h-4 w-4" />
          Recent Logs
          <span className="text-xs">(15m)</span>
        </h3>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-0.5 text-primary text-xs hover:underline"
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-72">
        <LogsBody
          logsData={logsData}
          loading={loading}
          error={error}
          hideServiceColumn
        />
      </div>
    </div>
  );
}

export interface OverviewTabProps {
  fn: NhostFunction;
  endpointUrl: string;
  defaultEndpointUrl?: string;
  onViewAllLogs: () => void;
  isPlatform: boolean;
}

export default function OverviewTab({
  fn,
  endpointUrl,
  defaultEndpointUrl,
  onViewAllLogs,
  isPlatform,
}: OverviewTabProps) {
  const { orgSlug, appSubdomain } = useRouter().query;
  const isPlaceholderDate = (date: string) => date.startsWith('0001-01-01');

  return (
    <div className="space-y-4">
      <MetadataCard title="Endpoint" icon={Globe} className="col-span-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded bg-muted p-2 font-mono text-sm">
            <span className="break-all">{endpointUrl}</span>
            <CopyToClipboardButton
              textToCopy={endpointUrl}
              title="Copy endpoint URL"
            />
          </div>
          {defaultEndpointUrl && (
            <div>
              <p className="mb-1 text-muted-foreground text-xs">
                Default endpoint
              </p>
              <div className="flex items-center justify-between gap-2 rounded bg-muted/50 p-2 font-mono text-muted-foreground text-xs">
                <span className="break-all">{defaultEndpointUrl}</span>
                <CopyToClipboardButton
                  textToCopy={defaultEndpointUrl}
                  title="Copy default endpoint URL"
                />
              </div>
            </div>
          )}
        </div>
      </MetadataCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetadataCard title="Runtime" icon={Cpu}>
          <div className="space-y-2">
            <MetadataRow label="Runtime" value={fn.runtime} />
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Route</span>
              <TextWithTooltip
                containerClassName="min-w-0"
                className="font-mono text-gray-900 dark:text-gray-100"
                truncateMode="middle"
                tailLength={12}
                text={fn.route}
              />
            </div>
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">File</span>
              <TextWithTooltip
                containerClassName="min-w-0"
                className="font-mono text-gray-900 dark:text-gray-100"
                truncateMode="middle"
                tailLength={12}
                text={fn.path}
              />
            </div>
          </div>
        </MetadataCard>

        <MetadataCard title="Deployment" icon={GitCommit}>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Commit</span>
              <div className="flex items-center gap-1">
                {isPlatform ? (
                  <Link
                    href={`/orgs/${orgSlug}/projects/${appSubdomain}/deployments`}
                    className="hover:underline"
                  >
                    <Badge variant="outline" className="font-mono text-xs">
                      {fn.createdWithCommitSha.slice(0, 7)}
                    </Badge>
                  </Link>
                ) : (
                  <Badge variant="outline" className="font-mono text-xs">
                    {fn.createdWithCommitSha}
                  </Badge>
                )}
                {isPlatform && (
                  <CopyToClipboardButton
                    textToCopy={fn.createdWithCommitSha}
                    title="Copy commit SHA"
                  />
                )}
              </div>
            </div>
            {fn.checksum && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="shrink-0 text-gray-600 dark:text-gray-400">
                  Checksum
                </span>
                <div className="flex min-w-0 items-center gap-1">
                  <TextWithTooltip
                    containerClassName="min-w-0"
                    className="font-mono text-gray-900 text-xs dark:text-gray-100"
                    truncateMode="middle"
                    text={fn.checksum}
                  />
                  <CopyToClipboardButton
                    textToCopy={fn.checksum}
                    title="Copy checksum"
                  />
                </div>
              </div>
            )}
          </div>
        </MetadataCard>
      </div>

      {(!isPlaceholderDate(fn.createdAt) ||
        !isPlaceholderDate(fn.updatedAt)) && (
        <MetadataCard title="Timestamps" icon={Clock}>
          <div className="grid grid-cols-1 gap-4 text-sm lg:grid-cols-2">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Created</span>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {formatDate(fn.createdAt)}
              </div>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Updated</span>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {formatDate(fn.updatedAt)}
              </div>
            </div>
          </div>
        </MetadataCard>
      )}

      {isPlatform && <RecentLogsCard fn={fn} onViewAll={onViewAllLogs} />}
    </div>
  );
}
