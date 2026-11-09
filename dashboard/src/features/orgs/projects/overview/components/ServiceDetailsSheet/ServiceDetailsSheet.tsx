import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import {
  ArrowRightIcon,
  CircleCheckIcon,
  FileTextIcon,
  SettingsIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/v3/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/v3/table';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ServiceIcon } from '@/features/orgs/projects/overview/components/ServiceIcon';
import { ServiceIssueAlert } from '@/features/orgs/projects/overview/components/ServiceIssueAlert';
import { ServiceStateIndicator } from '@/features/orgs/projects/overview/components/ServiceStateIndicator';
import type {
  OverviewService,
  OverviewServiceKey,
} from '@/features/orgs/projects/overview/hooks/useOverviewServices';
import { ServiceState } from '@/generated/graphql';
import { removeTypename } from '@/utils/helpers';

const settingsPathByService: Record<OverviewServiceKey, string> = {
  'hasura-auth': 'auth/settings',
  postgres: 'database/settings',
  'hasura-storage': 'storage/settings',
  hasura: 'graphql/settings',
  ai: 'ai/settings',
  run: 'run',
};

export interface ServiceDetailsSheetProps {
  service?: OverviewService;
  onOpenChange: (open: boolean) => void;
}

function NavigationCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
        <span className="flex-1 font-medium text-sm">{title}</span>
        <ArrowRightIcon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
      </span>
      <span className="text-muted-foreground text-xs">{description}</span>
    </Link>
  );
}

export default function ServiceDetailsSheet({
  service,
  onOpenChange,
}: ServiceDetailsSheetProps) {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const projectPath = `/orgs/${org?.slug}/projects/${project?.subdomain}`;

  const replicas = service?.status?.replicas ?? [];
  const readyReplicas = replicas.filter((replica) => replica.ready).length;
  const isRunService = service?.serviceKey === 'run';
  // The same JSON the old Service State pop-up showed, for anyone who wants
  // the exact data (support, an issue, debugging).
  const rawStatus = service?.status
    ? JSON.stringify(removeTypename(service.status), null, 2)
    : null;

  return (
    <Sheet open={!!service} onOpenChange={onOpenChange}>
      <SheetContent
        showOverlay
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        // Focus would land on the first button inside (copy raw status) and
        // pop its tooltip as soon as the panel opens. Keep focus on the panel.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {service && (
          <>
            <SheetHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-4 pr-12">
              <ServiceIcon serviceKey={service.serviceKey} />
              <SheetTitle className="text-base">{service.name}</SheetTitle>
              <SheetDescription className="ml-2">
                <ServiceStateIndicator state={service.status?.state} />
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
              <ServiceIssueAlert service={service} />

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableBody>
                    {!isRunService && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell className="w-2/5 py-2.5 align-top text-muted-foreground">
                          Current version
                        </TableCell>
                        <TableCell colSpan={2} className="py-2.5">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5">
                              <span className="font-mono">
                                {service.version ?? '-'}
                              </span>
                              {service.isVersionMismatch ? (
                                <TriangleAlertIcon
                                  aria-label="Not the recommended version"
                                  className="h-3.5 w-3.5 text-warning"
                                />
                              ) : (
                                <CircleCheckIcon
                                  aria-label="Recommended version"
                                  className="h-3.5 w-3.5 text-success"
                                />
                              )}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              Recommended:{' '}
                              <span className="font-mono">
                                {(service.isVersionMismatch
                                  ? service.recommendedVersion
                                  : service.version) ?? '-'}
                              </span>
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="w-2/5 py-2.5 text-muted-foreground">
                        Replicas
                      </TableCell>
                      <TableCell colSpan={2} className="py-2.5">
                        {readyReplicas} of {replicas.length} ready
                      </TableCell>
                    </TableRow>
                    {/* One row per replica only when there are several, so
                        it's clear which copy is down. A single replica is
                        already covered by the row above. */}
                    {replicas.length > 1 &&
                      replicas.map((replica, index) => (
                        <TableRow
                          // Replicas have no id, their order is stable
                          // biome-ignore lint/suspicious/noArrayIndexKey: see above
                          key={index}
                          className="hover:bg-transparent"
                        >
                          <TableCell className="py-2.5 text-muted-foreground">
                            Replica {index + 1}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <ServiceStateIndicator
                              state={
                                replica.ready
                                  ? ServiceState.Running
                                  : ServiceState.Error
                              }
                              label={replica.ready ? 'Ready' : 'Not ready'}
                            />
                          </TableCell>
                          <TableCell className="py-2.5 text-muted-foreground">
                            {replica.date
                              ? `${formatDistanceToNowStrict(parseISO(replica.date))} ago`
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    {rawStatus && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell className="w-2/5 py-1.5 text-muted-foreground">
                          Raw status
                        </TableCell>
                        <TableCell className="py-1.5 font-mono text-muted-foreground text-xs">
                          JSON
                        </TableCell>
                        <TableCell className="w-0 py-1.5 pr-2 text-right">
                          <CopyToClipboardButton
                            textToCopy={rawStatus}
                            title="raw status"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <nav className="grid grid-cols-2 gap-3">
                <NavigationCard
                  href={`${projectPath}/logs`}
                  icon={<FileTextIcon />}
                  title="Logs"
                  description="Open the project logs"
                />
                <NavigationCard
                  href={`${projectPath}/${settingsPathByService[service.serviceKey]}`}
                  icon={<SettingsIcon />}
                  title="Settings"
                  description={
                    isRunService
                      ? 'Run services and their configuration'
                      : 'Version and configuration'
                  }
                />
              </nav>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
