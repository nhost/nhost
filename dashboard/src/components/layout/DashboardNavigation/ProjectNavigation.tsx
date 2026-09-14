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
import { useCurrentRoute } from '@/components/layout/DashboardNavigation/useCurrentRoute';
import { NavigationList } from '@/components/layout/NavigationList';
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

export function ProjectNavigationFooter() {
  const { baseHref, isActive } = useProjectRoute();
  const settingsDisabled = useSettingsDisabled();

  return (
    <NavigationList.Item
      label="Settings"
      href={`${baseHref}/settings`}
      icon={<CogIcon className={iconClassName} />}
      active={isActive(`${baseHref}/settings`)}
      disabled={settingsDisabled}
    />
  );
}

export default function ProjectNavigation() {
  const { currentPath, baseHref, isActive } = useProjectRoute();
  const isPlatform = useIsPlatform();
  const settingsDisabled = useSettingsDisabled();

  return (
    <>
      <NavigationList.Section>
        <NavigationList.Item
          label="Overview"
          href={baseHref}
          icon={<HomeIcon className={iconClassName} />}
          active={currentPath === baseHref}
        />
      </NavigationList.Section>

      <NavigationList.Section label="Build">
        <NavigationList.Item
          label="Database"
          href={`${baseHref}/database/browser/default`}
          icon={<DatabaseIcon className={iconClassName} />}
          active={isActive(`${baseHref}/database`)}
        />
        <NavigationList.Item
          label="GraphQL"
          href={`${baseHref}/graphql`}
          icon={<GraphQLIcon className={iconClassName} />}
          active={isActive(`${baseHref}/graphql`)}
        />
        <NavigationList.Item
          label="Auth"
          href={`${baseHref}/auth/users`}
          icon={<UserIcon className={iconClassName} />}
          active={isActive(`${baseHref}/auth`)}
        />
        <NavigationList.Item
          label="Storage"
          href={`${baseHref}/storage`}
          icon={<HardDriveIcon className={iconClassName} />}
          active={isActive(`${baseHref}/storage`)}
        />
        <NavigationList.Item
          label="Events"
          href={`${baseHref}/events/event-triggers`}
          icon={<ZapIcon className={iconClassName} />}
          active={isActive(`${baseHref}/events`)}
        />
      </NavigationList.Section>

      <NavigationList.Section label="Compute">
        <NavigationList.Item
          label="AI"
          href={`${baseHref}/ai/assistants`}
          icon={<SparklesIcon className={iconClassName} />}
          active={isActive(`${baseHref}/ai`)}
          disabled={settingsDisabled}
        />
        <NavigationList.Item
          label="Functions"
          href={`${baseHref}/functions`}
          icon={<CodeIcon className={iconClassName} />}
          active={isActive(`${baseHref}/functions`)}
        />
        <NavigationList.Item
          label="Run"
          href={`${baseHref}/run`}
          icon={<ServicesIcon className={iconClassName} />}
          active={isActive(`${baseHref}/run`)}
        />
      </NavigationList.Section>

      <NavigationList.Section label="Operate">
        <NavigationList.Item
          label="Deployments"
          href={`${baseHref}/deployments`}
          icon={<RocketIcon className={iconClassName} />}
          active={isActive(`${baseHref}/deployments`)}
          disabled={!isPlatform}
        />
        <NavigationList.Item
          label="Logs"
          href={`${baseHref}/logs`}
          icon={<FileTextIcon className={iconClassName} />}
          active={isActive(`${baseHref}/logs`)}
        />
        <NavigationList.Item
          label="Metrics"
          href={`${baseHref}/metrics`}
          icon={<GaugeIcon className={iconClassName} />}
          active={isActive(`${baseHref}/metrics`)}
          disabled={!isPlatform}
        />
      </NavigationList.Section>
    </>
  );
}
