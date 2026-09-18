import {
  SiGraphql as GraphQLIcon,
  SiDocker as ServicesIcon,
} from '@icons-pack/react-simple-icons';
import {
  CodeIcon,
  CogIcon,
  DatabaseIcon,
  FileTextIcon,
  FolderIcon,
  GaugeIcon,
  GitBranchIcon,
  HardDriveIcon,
  HomeIcon,
  RocketIcon,
  SparklesIcon,
  UserIcon,
  ZapIcon,
} from 'lucide-react';
import { useCurrentRoute } from '@/components/layout/AppSidebar/useCurrentRoute';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';

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

export function ProjectNavFooter() {
  const { baseHref, isActive } = useProjectRoute();
  const settingsDisabled = useSettingsDisabled();

  return (
    <DashboardSidebar.Item
      label="Settings"
      href={`${baseHref}/settings`}
      icon={<CogIcon className={iconClassName} />}
      active={isActive(`${baseHref}/settings`)}
      disabled={settingsDisabled}
    />
  );
}

export default function ProjectNav() {
  const { currentPath, baseHref, isActive } = useProjectRoute();
  const isPlatform = useIsPlatform();
  const settingsDisabled = useSettingsDisabled();

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
        />
        <DashboardSidebar.Item
          label="GraphQL"
          href={`${baseHref}/graphql`}
          icon={<GraphQLIcon className={iconClassName} />}
          active={isActive(`${baseHref}/graphql`)}
        />
        <DashboardSidebar.Item
          label="Auth"
          href={`${baseHref}/auth/users`}
          icon={<UserIcon className={iconClassName} />}
          active={isActive(`${baseHref}/auth`)}
        />
        <DashboardSidebar.Item
          label="Storage"
          href={`${baseHref}/storage`}
          icon={<HardDriveIcon className={iconClassName} />}
          active={isActive(`${baseHref}/storage`)}
        />
        <DashboardSidebar.Item
          label="Events"
          href={`${baseHref}/events/event-triggers`}
          icon={<ZapIcon className={iconClassName} />}
          active={isActive(`${baseHref}/events`)}
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="Compute">
        <DashboardSidebar.Item
          label="Functions"
          href={`${baseHref}/functions`}
          icon={<CodeIcon className={iconClassName} />}
          active={isActive(`${baseHref}/functions`)}
        />
        <DashboardSidebar.Item
          label="Run"
          href={`${baseHref}/run`}
          icon={<ServicesIcon className={iconClassName} />}
          active={isActive(`${baseHref}/run`)}
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="AI">
        <DashboardSidebar.Item
          label="Agents"
          href={`${baseHref}/ai/assistants`}
          icon={<SparklesIcon className={iconClassName} />}
          active={isActive(`${baseHref}/ai/assistants`)}
          disabled={settingsDisabled}
        />
        <DashboardSidebar.Item
          label="File Stores"
          href={`${baseHref}/ai/file-stores`}
          icon={<FolderIcon className={iconClassName} />}
          active={isActive(`${baseHref}/ai/file-stores`)}
          disabled={settingsDisabled}
        />
        <DashboardSidebar.Item
          label="Auto-Embeddings"
          href={`${baseHref}/ai/auto-embeddings`}
          icon={<GitBranchIcon className={iconClassName} />}
          active={isActive(`${baseHref}/ai/auto-embeddings`)}
          disabled={settingsDisabled}
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
          disabled={!isPlatform}
        />
      </DashboardSidebar.Section>
    </>
  );
}
