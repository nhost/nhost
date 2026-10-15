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

export default function ProjectNavigation() {
  const { orgSlug, appSubdomain } = useCurrentRoute();
  // Matches whole sections for items that link to a page inside them.
  const baseHref = `/orgs/${orgSlug}/projects/${appSubdomain}`;
  const isPlatform = useIsPlatform();
  const settingsDisabled = useSettingsDisabled();

  return (
    <>
      <NavigationList.Section>
        <NavigationList.Item
          label="Overview"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain"
          params
          icon={<HomeIcon className={iconClassName} />}
          exact
        />
      </NavigationList.Section>

      <NavigationList.Section label="Build">
        <NavigationList.Item
          label="Database"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug"
          params={(params) => ({ ...params, dataSourceSlug: 'default' })}
          icon={<DatabaseIcon className={iconClassName} />}
          activePath={`${baseHref}/database`}
        />
        <NavigationList.Item
          label="GraphQL"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain/graphql"
          params
          icon={<GraphQLIcon className={iconClassName} />}
        />
        <NavigationList.Item
          label="Auth"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain/auth/users"
          params
          icon={<UserIcon className={iconClassName} />}
          activePath={`${baseHref}/auth`}
        />
        <NavigationList.Item
          label="Storage"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain/storage/buckets"
          params
          icon={<HardDriveIcon className={iconClassName} />}
          activePath={`${baseHref}/storage`}
        />
        <NavigationList.Item
          label="Events"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain/events/event-triggers"
          params
          icon={<ZapIcon className={iconClassName} />}
          activePath={`${baseHref}/events`}
        />
        <NavigationList.Item
          label="AI"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain/ai/assistants"
          params
          icon={<SparklesIcon className={iconClassName} />}
          activePath={`${baseHref}/ai`}
          disabled={settingsDisabled}
        />
      </NavigationList.Section>

      <NavigationList.Section label="Compute">
        <NavigationList.Item
          label="Functions"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain/functions/browser"
          params
          icon={<CodeIcon className={iconClassName} />}
          activePath={`${baseHref}/functions`}
        />
        <NavigationList.Item
          label="Run"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain/run"
          params
          icon={<ServicesIcon className={iconClassName} />}
        />
      </NavigationList.Section>

      <NavigationList.Section label="Operate">
        {/* Off-platform only the Deployments settings page exists. */}
        <NavigationList.Item
          label="Deployments"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to={
            isPlatform
              ? '/orgs/$orgSlug/projects/$appSubdomain/deployments'
              : '/orgs/$orgSlug/projects/$appSubdomain/deployments/settings'
          }
          params
          icon={<RocketIcon className={iconClassName} />}
          activePath={`${baseHref}/deployments`}
          disabled={!isPlatform && settingsDisabled}
        />
        <NavigationList.Item
          label="Logs"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain/logs"
          params
          icon={<FileTextIcon className={iconClassName} />}
        />
        <NavigationList.Item
          label="Metrics"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to={
            isPlatform
              ? '/orgs/$orgSlug/projects/$appSubdomain/metrics'
              : '/orgs/$orgSlug/projects/$appSubdomain/metrics/settings'
          }
          params
          icon={<GaugeIcon className={iconClassName} />}
          activePath={`${baseHref}/metrics`}
          disabled={!isPlatform && settingsDisabled}
        />
      </NavigationList.Section>

      <div className="-mx-2 my-2 border-t" />

      <NavigationList.Section className="mt-0">
        <NavigationList.Item
          label="Settings"
          from="/orgs/$orgSlug/projects/$appSubdomain"
          to="/orgs/$orgSlug/projects/$appSubdomain/settings"
          params
          icon={<CogIcon className={iconClassName} />}
          disabled={settingsDisabled}
        />
      </NavigationList.Section>
    </>
  );
}
