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

function useProjectBaseHref() {
  const { orgSlug, appSubdomain } = useCurrentRoute();

  return `/orgs/${orgSlug}/projects/${appSubdomain}`;
}

export function ProjectNavFooter() {
  const baseHref = useProjectBaseHref();
  const settingsDisabled = useSettingsDisabled();

  return (
    <DashboardSidebar.Item
      label="Settings"
      href={`${baseHref}/settings`}
      icon={<CogIcon className={iconClassName} />}
      disabled={settingsDisabled}
    />
  );
}

export default function ProjectNav() {
  const baseHref = useProjectBaseHref();
  const isPlatform = useIsPlatform();
  const settingsDisabled = useSettingsDisabled();

  return (
    <>
      <DashboardSidebar.Section>
        <DashboardSidebar.Item
          label="Overview"
          href={baseHref}
          icon={<HomeIcon className={iconClassName} />}
          exact
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="Build">
        <DashboardSidebar.Item
          label="Database"
          href={`${baseHref}/database/browser/default`}
          icon={<DatabaseIcon className={iconClassName} />}
          activePath={`${baseHref}/database`}
        />
        <DashboardSidebar.Item
          label="GraphQL"
          href={`${baseHref}/graphql`}
          icon={<GraphQLIcon className={iconClassName} />}
        />
        <DashboardSidebar.Item
          label="Auth"
          href={`${baseHref}/auth/users`}
          icon={<UserIcon className={iconClassName} />}
          activePath={`${baseHref}/auth`}
        />
        <DashboardSidebar.Item
          label="Storage"
          href={`${baseHref}/storage/buckets`}
          icon={<HardDriveIcon className={iconClassName} />}
          activePath={`${baseHref}/storage`}
        />
        <DashboardSidebar.Item
          label="Events"
          href={`${baseHref}/events/event-triggers`}
          icon={<ZapIcon className={iconClassName} />}
          activePath={`${baseHref}/events`}
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="Compute">
        <DashboardSidebar.Item
          label="Functions"
          href={`${baseHref}/functions/browser`}
          icon={<CodeIcon className={iconClassName} />}
          activePath={`${baseHref}/functions`}
        />
        <DashboardSidebar.Item
          label="Run"
          href={`${baseHref}/run`}
          icon={<ServicesIcon className={iconClassName} />}
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="AI">
        <DashboardSidebar.Item
          label="Agents"
          href={`${baseHref}/ai/assistants`}
          icon={<SparklesIcon className={iconClassName} />}
          disabled={settingsDisabled}
        />
        <DashboardSidebar.Item
          label="File Stores"
          href={`${baseHref}/ai/file-stores`}
          icon={<FolderIcon className={iconClassName} />}
          disabled={settingsDisabled}
        />
        <DashboardSidebar.Item
          label="Auto-Embeddings"
          href={`${baseHref}/ai/auto-embeddings`}
          icon={<GitBranchIcon className={iconClassName} />}
          disabled={settingsDisabled}
        />
      </DashboardSidebar.Section>

      <DashboardSidebar.Section label="Operate">
        {/* Off-platform only the Deployments settings page exists. */}
        <DashboardSidebar.Item
          label="Deployments"
          href={
            isPlatform
              ? `${baseHref}/deployments`
              : `${baseHref}/deployments/settings`
          }
          icon={<RocketIcon className={iconClassName} />}
          activePath={`${baseHref}/deployments`}
          disabled={!isPlatform && settingsDisabled}
        />
        <DashboardSidebar.Item
          label="Logs"
          href={`${baseHref}/logs`}
          icon={<FileTextIcon className={iconClassName} />}
        />
        <DashboardSidebar.Item
          label="Metrics"
          href={
            isPlatform ? `${baseHref}/metrics` : `${baseHref}/metrics/settings`
          }
          icon={<GaugeIcon className={iconClassName} />}
          activePath={`${baseHref}/metrics`}
          disabled={!isPlatform && settingsDisabled}
        />
      </DashboardSidebar.Section>
    </>
  );
}
