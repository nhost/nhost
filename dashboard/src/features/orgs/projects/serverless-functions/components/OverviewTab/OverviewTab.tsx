import { Cpu, GitCommit, Globe } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import CopyToClipboardButton from '@/components/presentational/CopyToClipboardButton/CopyToClipboardButton';
import { Badge } from '@/components/ui/v3/badge';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { TruncatedText } from '@/features/orgs/projects/common/components/TruncatedText';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  MetadataCard,
  MetadataRow,
} from '@/features/orgs/projects/serverless-functions/components/MetadataCard';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';
import { useGetUnifiedDeploymentByCommitShaQuery } from '@/generated/graphql';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';

export interface OverviewTabProps {
  fn: NhostFunction;
  endpointUrl: string;
  defaultEndpointUrl?: string;
}

export default function OverviewTab({
  fn,
  endpointUrl,
  defaultEndpointUrl,
}: OverviewTabProps) {
  const isPlatform = useIsPlatform();
  const { orgSlug, appSubdomain } = useRouter().query;
  const { project } = useProject();
  const showDeploymentCard =
    isPlatform &&
    (isNotEmptyValue(fn.createdWithCommitSha) || isNotEmptyValue(fn.checksum));

  const { data: deploymentData } = useGetUnifiedDeploymentByCommitShaQuery({
    variables: {
      appId: project?.id,
      commitSHA: fn.createdWithCommitSha ?? '',
    },
    skip: !isPlatform || !project?.id || isEmptyValue(fn.createdWithCommitSha),
  });

  const deploymentId = deploymentData?.unifiedDeployments[0]?.id;
  const deploymentsBasePath = `/orgs/${orgSlug}/projects/${appSubdomain}/deployments`;
  const commitHref = deploymentId
    ? `${deploymentsBasePath}/${deploymentId}`
    : deploymentsBasePath;

  return (
    <div className="space-y-4">
      <MetadataCard title="Endpoint" icon={Globe} className="col-span-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded bg-muted p-2 font-mono text-sm">
            <TruncatedText text={endpointUrl} tailLength={12} />
            <CopyToClipboardButton
              textToCopy={endpointUrl}
              title="Endpoint URL"
            />
          </div>
          {defaultEndpointUrl && (
            <div>
              <p className="mb-1 text-muted-foreground text-xs">
                Default endpoint
              </p>
              <div className="flex items-center justify-between gap-2 rounded bg-muted/50 p-2 font-mono text-muted-foreground text-xs">
                <TruncatedText text={defaultEndpointUrl} tailLength={12} />
                <CopyToClipboardButton
                  textToCopy={defaultEndpointUrl}
                  title="Default endpoint URL"
                />
              </div>
            </div>
          )}
        </div>
      </MetadataCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MetadataCard
          title="Runtime"
          icon={Cpu}
          className={!showDeploymentCard ? 'col-span-2' : undefined}
        >
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

        {showDeploymentCard && (
          <MetadataCard title="Deployment" icon={GitCommit}>
            <div className="space-y-2">
              {isNotEmptyValue(fn.createdWithCommitSha) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Commit
                  </span>
                  <div className="flex items-center gap-1">
                    <Link href={commitHref} className="hover:underline">
                      <Badge variant="outline" className="font-mono text-xs">
                        {fn.createdWithCommitSha.slice(0, 7)}
                      </Badge>
                    </Link>
                    <CopyToClipboardButton
                      textToCopy={fn.createdWithCommitSha}
                      title="Commit SHA"
                    />
                  </div>
                </div>
              )}
              {isNotEmptyValue(fn.checksum) && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="shrink-0 text-gray-600 dark:text-gray-400">
                    Checksum
                  </span>
                  <div className="flex min-w-0 items-center gap-1">
                    <Badge
                      variant="outline"
                      className="max-w-24 font-mono font-normal text-xs"
                    >
                      <TruncatedText text={fn.checksum} tailLength={4} />
                    </Badge>
                    <CopyToClipboardButton
                      textToCopy={fn.checksum}
                      title="Checksum"
                    />
                  </div>
                </div>
              )}
            </div>
          </MetadataCard>
        )}
      </div>
    </div>
  );
}
