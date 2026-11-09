import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ArrowRightIcon, FileTextIcon, SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
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

function NavigationRow({
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
      className="group flex items-center gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/50"
    >
      <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="font-medium text-sm">{title}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </span>
      <ArrowRightIcon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
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

  return (
    <Sheet open={!!service} onOpenChange={onOpenChange}>
      <SheetContent
        showOverlay
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        {service && (
          <>
            <SheetHeader className="flex-row items-center gap-3 space-y-0 border-b px-5 py-4 pr-12">
              <ServiceIcon serviceKey={service.serviceKey} />
              <div className="flex flex-col gap-0.5">
                <SheetTitle className="text-base">{service.name}</SheetTitle>
                <SheetDescription>
                  <ServiceStateIndicator state={service.status?.state} />
                </SheetDescription>
              </div>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
              <ServiceIssueAlert service={service} />

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableBody>
                    {!isRunService && (
                      <>
                        <TableRow className="hover:bg-transparent">
                          <TableCell className="w-2/5 py-2.5 text-muted-foreground">
                            Version
                          </TableCell>
                          <TableCell colSpan={2} className="py-2.5 font-mono">
                            {service.version ?? '-'}
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-transparent">
                          <TableCell className="py-2.5 text-muted-foreground">
                            Recommended
                          </TableCell>
                          <TableCell colSpan={2} className="py-2.5">
                            {service.isVersionMismatch ? (
                              <span className="font-mono">
                                {service.recommendedVersion ?? '-'}
                              </span>
                            ) : (
                              'Yes'
                            )}
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell className="py-2 font-medium text-muted-foreground">
                        Replicas
                      </TableCell>
                      <TableCell
                        colSpan={2}
                        className="py-2 font-medium text-muted-foreground"
                      >
                        {readyReplicas}/{replicas.length} ready
                      </TableCell>
                    </TableRow>
                    {replicas.map((replica, index) => (
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
                  </TableBody>
                </Table>
              </div>

              <nav className="overflow-hidden rounded-lg border">
                <NavigationRow
                  href={`${projectPath}/logs`}
                  icon={<FileTextIcon />}
                  title="Logs"
                  description="Open the project logs"
                />
                <NavigationRow
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
