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
import { useRouter } from 'next/router';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

const iconClassName = 'size-4';

export default function ProjectLayoutSidebar() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const shouldDisableSettings = useSettingsDisabled();
  const currentPath = router.asPath.split(/[?#]/)[0].replace(/\/$/, '');
  const [
    ,
    orgsSegment,
    orgSlugFromPath,
    projectsSegment,
    appSubdomainFromPath,
  ] = currentPath.split('/');
  const orgSlug =
    getSingleQueryParam(router.query.orgSlug) ??
    (orgsSegment === 'orgs' ? orgSlugFromPath : undefined);
  const appSubdomain =
    getSingleQueryParam(router.query.appSubdomain) ??
    (projectsSegment === 'projects' ? appSubdomainFromPath : undefined);
  const projectBaseHref = `/orgs/${orgSlug}/projects/${appSubdomain}`;

  return (
    <DashboardSidebar
      ariaLabel="Project navigation"
      storageKey="project-sidebar-collapsed"
      footer={
        <DashboardSidebar.Item
          label="Settings"
          href={`${projectBaseHref}/settings`}
          icon={<CogIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/settings` ||
            currentPath.startsWith(`${projectBaseHref}/settings/`)
          }
          disabled={shouldDisableSettings}
        />
      }
    >
      <DashboardSidebar.Section>
        <DashboardSidebar.Item
          label="Overview"
          href={projectBaseHref}
          icon={<HomeIcon className={iconClassName} />}
          active={currentPath === projectBaseHref}
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="AI">
        <DashboardSidebar.Item
          label="Agents"
          href={`${projectBaseHref}/ai/assistants`}
          icon={<SparklesIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/ai/assistants` ||
            currentPath.startsWith(`${projectBaseHref}/ai/assistants/`)
          }
          disabled={shouldDisableSettings}
        />
        <DashboardSidebar.Item
          label="File Stores"
          href={`${projectBaseHref}/ai/file-stores`}
          icon={<FolderIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/ai/file-stores` ||
            currentPath.startsWith(`${projectBaseHref}/ai/file-stores/`)
          }
          disabled={shouldDisableSettings}
        />
        <DashboardSidebar.Item
          label="Auto-Embeddings"
          href={`${projectBaseHref}/ai/auto-embeddings`}
          icon={<GitBranchIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/ai/auto-embeddings` ||
            currentPath.startsWith(`${projectBaseHref}/ai/auto-embeddings/`)
          }
          disabled={shouldDisableSettings}
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="Build">
        <DashboardSidebar.Item
          label="Database"
          href={`${projectBaseHref}/database/browser/default`}
          icon={<DatabaseIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/database` ||
            currentPath.startsWith(`${projectBaseHref}/database/`)
          }
        />
        <DashboardSidebar.Item
          label="GraphQL"
          href={`${projectBaseHref}/graphql`}
          icon={<GraphQLIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/graphql` ||
            currentPath.startsWith(`${projectBaseHref}/graphql/`)
          }
        />
        <DashboardSidebar.Item
          label="Auth"
          href={`${projectBaseHref}/auth/users`}
          icon={<UserIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/auth` ||
            currentPath.startsWith(`${projectBaseHref}/auth/`)
          }
        />
        <DashboardSidebar.Item
          label="Storage"
          href={`${projectBaseHref}/storage`}
          icon={<HardDriveIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/storage` ||
            currentPath.startsWith(`${projectBaseHref}/storage/`)
          }
        />
        <DashboardSidebar.Item
          label="Events"
          href={`${projectBaseHref}/events/event-triggers`}
          icon={<ZapIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/events` ||
            currentPath.startsWith(`${projectBaseHref}/events/`)
          }
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="Compute">
        <DashboardSidebar.Item
          label="Functions"
          href={`${projectBaseHref}/functions`}
          icon={<CodeIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/functions` ||
            currentPath.startsWith(`${projectBaseHref}/functions/`)
          }
        />
        <DashboardSidebar.Item
          label="Run"
          href={`${projectBaseHref}/run`}
          icon={<ServicesIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/run` ||
            currentPath.startsWith(`${projectBaseHref}/run/`)
          }
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="Operate">
        <DashboardSidebar.Item
          label="Deployments"
          href={`${projectBaseHref}/deployments`}
          icon={<RocketIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/deployments` ||
            currentPath.startsWith(`${projectBaseHref}/deployments/`)
          }
          disabled={!isPlatform}
        />
        <DashboardSidebar.Item
          label="Logs"
          href={`${projectBaseHref}/logs`}
          icon={<FileTextIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/logs` ||
            currentPath.startsWith(`${projectBaseHref}/logs/`)
          }
        />
        <DashboardSidebar.Item
          label="Metrics"
          href={`${projectBaseHref}/metrics`}
          icon={<GaugeIcon className={iconClassName} />}
          active={
            currentPath === `${projectBaseHref}/metrics` ||
            currentPath.startsWith(`${projectBaseHref}/metrics/`)
          }
          disabled={!isPlatform}
        />
      </DashboardSidebar.Section>
    </DashboardSidebar>
  );
}
