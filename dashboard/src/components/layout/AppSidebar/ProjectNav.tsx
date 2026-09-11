import {
  SiGraphql as GraphQLIcon,
  SiDocker as ServicesIcon,
} from '@icons-pack/react-simple-icons';
import {
  CodeIcon,
  CogIcon,
  DatabaseIcon,
  FileTextIcon,
  GaugeIcon,
  HardDriveIcon,
  HomeIcon,
  RocketIcon,
  SparklesIcon,
  UserIcon,
  ZapIcon,
} from 'lucide-react';
import { ProTag } from '@/components/common/ProTag';
import { useCurrentRoute } from '@/components/layout/AppSidebar/useCurrentRoute';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { ApplicationStatus } from '@/types/application';

const PAUSED_FAMILY_STATES: ApplicationStatus[] = [
  ApplicationStatus.Pausing,
  ApplicationStatus.Paused,
  ApplicationStatus.Unpausing,
  ApplicationStatus.Restoring,
];

const iconClassName = 'size-4';

function useProjectRoute() {
  const { currentPath, orgSlug, appSubdomain } = useCurrentRoute();

  return {
    currentPath,
    baseHref: `/orgs/${orgSlug}/projects/${appSubdomain}`,
    isActive: (path: string) =>
      currentPath === path || currentPath.startsWith(`${path}/`),
  };
}

export default function ProjectNav() {
  const { currentPath, baseHref, isActive } = useProjectRoute();
  const isPlatform = useIsPlatform();
  const settingsDisabled = useSettingsDisabled();
  const { org } = useCurrentOrg();
  const { state: appState } = useAppState();
  const isFreeOrg = isPlatform && org?.plan?.isFree;
  const proTag = isFreeOrg ? <ProTag /> : undefined;
  // While the project is paused/pausing/waking up/restoring, only Overview,
  // Deployments, Logs and Settings stay usable — everything else that
  // depends on the project actually running gets disabled.
  const disabledWhilePaused = PAUSED_FAMILY_STATES.includes(appState);

  return (
    <>
      <DashboardSidebar.Section>
        <DashboardSidebar.Item
          label="Overview"
          href={baseHref}
          icon={<HomeIcon className={iconClassName} />}
          active={currentPath === baseHref}
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="Build">
        <DashboardSidebar.Item
          label="Database"
          href={`${baseHref}/database/browser/default`}
          icon={<DatabaseIcon className={iconClassName} />}
          active={isActive(`${baseHref}/database`)}
          disabled={disabledWhilePaused}
        />
        <DashboardSidebar.Item
          label="GraphQL"
          href={`${baseHref}/graphql`}
          icon={<GraphQLIcon className={iconClassName} />}
          active={isActive(`${baseHref}/graphql`)}
          disabled={disabledWhilePaused}
        />
        <DashboardSidebar.Item
          label="Auth"
          href={`${baseHref}/auth/users`}
          icon={<UserIcon className={iconClassName} />}
          active={isActive(`${baseHref}/auth`)}
          disabled={disabledWhilePaused}
        />
        <DashboardSidebar.Item
          label="Storage"
          href={`${baseHref}/storage`}
          icon={<HardDriveIcon className={iconClassName} />}
          active={isActive(`${baseHref}/storage`)}
          disabled={disabledWhilePaused}
        />
        <DashboardSidebar.Item
          label="Events"
          href={`${baseHref}/events/event-triggers`}
          icon={<ZapIcon className={iconClassName} />}
          active={isActive(`${baseHref}/events`)}
          disabled={disabledWhilePaused}
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="Compute">
        <DashboardSidebar.Item
          label="AI"
          href={`${baseHref}/ai/assistants`}
          icon={<SparklesIcon className={iconClassName} />}
          active={isActive(`${baseHref}/ai`)}
          disabled={settingsDisabled || disabledWhilePaused}
          tag={proTag}
        />
        <DashboardSidebar.Item
          label="Functions"
          href={`${baseHref}/functions`}
          icon={<CodeIcon className={iconClassName} />}
          active={isActive(`${baseHref}/functions`)}
          disabled={disabledWhilePaused}
        />
        <DashboardSidebar.Item
          label="Run"
          href={`${baseHref}/run`}
          icon={<ServicesIcon className={iconClassName} />}
          active={isActive(`${baseHref}/run`)}
          disabled={disabledWhilePaused}
          tag={proTag}
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="Operate">
        <DashboardSidebar.Item
          label="Deployments"
          href={`${baseHref}/deployments`}
          icon={<RocketIcon className={iconClassName} />}
          active={isActive(`${baseHref}/deployments`)}
          disabled={!isPlatform}
        />
        <DashboardSidebar.Item
          label="Logs"
          href={`${baseHref}/logs`}
          icon={<FileTextIcon className={iconClassName} />}
          active={isActive(`${baseHref}/logs`)}
        />
        <DashboardSidebar.Item
          label="Metrics"
          href={`${baseHref}/metrics`}
          icon={<GaugeIcon className={iconClassName} />}
          active={isActive(`${baseHref}/metrics`)}
          disabled={!isPlatform || disabledWhilePaused}
          tag={proTag}
        />
      </DashboardSidebar.Section>

      <div className="-mx-2 my-2 border-t" />

      <DashboardSidebar.Section className="mt-0">
        <DashboardSidebar.Item
          label="Settings"
          href={`${baseHref}/settings`}
          icon={<CogIcon className={iconClassName} />}
          active={isActive(`${baseHref}/settings`)}
          disabled={settingsDisabled}
        />
      </DashboardSidebar.Section>
    </>
  );
}
