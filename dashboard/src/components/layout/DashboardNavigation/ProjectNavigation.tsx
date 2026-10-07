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

function useProjectBaseHref() {
  const { orgSlug, appSubdomain } = useCurrentRoute();

  return `/orgs/${orgSlug}/projects/${appSubdomain}`;
}

export default function ProjectNavigation() {
  const baseHref = useProjectBaseHref();
  const isPlatform = useIsPlatform();
  const settingsDisabled = useSettingsDisabled();

  return (
    <>
      <NavigationList.Section>
        <NavigationList.Item
          label="Overview"
          href={baseHref}
          icon={<HomeIcon className={iconClassName} />}
          exact
        />
      </NavigationList.Section>

      <NavigationList.Section label="Build">
        <NavigationList.Item
          label="Database"
          href={`${baseHref}/database/browser/default`}
          icon={<DatabaseIcon className={iconClassName} />}
          activePath={`${baseHref}/database`}
        />
        <NavigationList.Item
          label="GraphQL"
          href={`${baseHref}/graphql`}
          icon={<GraphQLIcon className={iconClassName} />}
        />
        <NavigationList.Item
          label="Auth"
          href={`${baseHref}/auth/users`}
          icon={<UserIcon className={iconClassName} />}
          activePath={`${baseHref}/auth`}
        />
        <NavigationList.Item
          label="Storage"
          href={`${baseHref}/storage/buckets`}
          icon={<HardDriveIcon className={iconClassName} />}
          activePath={`${baseHref}/storage`}
        />
        <NavigationList.Item
          label="Events"
          href={`${baseHref}/events/event-triggers`}
          icon={<ZapIcon className={iconClassName} />}
          activePath={`${baseHref}/events`}
        />
        <NavigationList.Item
          label="AI"
          href={`${baseHref}/ai/assistants`}
          icon={<SparklesIcon className={iconClassName} />}
          activePath={`${baseHref}/ai`}
          disabled={settingsDisabled}
        />
      </NavigationList.Section>

      <NavigationList.Section label="Compute">
        <NavigationList.Item
          label="Functions"
          href={`${baseHref}/functions/browser`}
          icon={<CodeIcon className={iconClassName} />}
          activePath={`${baseHref}/functions`}
        />
        <NavigationList.Item
          label="Run"
          href={`${baseHref}/run`}
          icon={<ServicesIcon className={iconClassName} />}
        />
      </NavigationList.Section>

      <NavigationList.Section label="Operate">
        {/* Off-platform only the Deployments settings page exists. */}
        <NavigationList.Item
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
        <NavigationList.Item
          label="Logs"
          href={`${baseHref}/logs`}
          icon={<FileTextIcon className={iconClassName} />}
        />
        <NavigationList.Item
          label="Metrics"
          href={
            isPlatform ? `${baseHref}/metrics` : `${baseHref}/metrics/settings`
          }
          icon={<GaugeIcon className={iconClassName} />}
          activePath={`${baseHref}/metrics`}
          disabled={!isPlatform && settingsDisabled}
        />
      </NavigationList.Section>

      <div className="-mx-2 my-2 border-t" />

      <NavigationList.Section className="mt-0">
        <NavigationList.Item
          label="Settings"
          href={`${baseHref}/settings`}
          icon={<CogIcon className={iconClassName} />}
          disabled={settingsDisabled}
        />
      </NavigationList.Section>
    </>
  );
}
