import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { Combobox } from '@/components/ui/v3/combobox';
import { MIN_AUTH_VERSION_OAUTH2 } from '@/features/orgs/projects/authentication/oauth2/constants';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSoftwareVersionsInfo } from '@/features/orgs/projects/common/hooks/useSoftwareVersionsInfo';
import { isVersionGte } from '@/utils/compareVersions';

const allProjectSettingsPages = [
  { name: 'General', slug: 'general', route: '' },
  {
    name: 'Compute Resources',
    slug: 'compute-resources',
    route: 'compute-resources',
  },
  { name: 'Database', slug: 'database', route: 'database' },
  { name: 'Hasura', slug: 'hasura', route: 'hasura' },
  {
    name: 'Authentication',
    slug: 'authentication',
    route: 'authentication',
  },
  {
    name: 'JWT',
    slug: 'jwt',
    route: 'jwt',
  },
  {
    name: 'Sign-In methods',
    slug: 'sign-in-methods',
    route: 'sign-in-methods',
  },
  { name: 'Storage', slug: 'storage', route: 'storage' },
  {
    name: 'Roles and Permissions',
    slug: 'roles-and-permissions',
    route: 'roles-and-permissions',
  },
  { name: 'SMTP', slug: 'smtp', route: 'smtp' },
  { name: 'Deployments', slug: 'deployments', route: 'deployments' },
  {
    name: 'Environment Variables',
    slug: 'environment-variables',
    route: 'environment-variables',
  },
  { name: 'Secrets', slug: 'secrets', route: 'secrets' },
  {
    name: 'Custom Domains',
    slug: 'custom-domains',
    route: 'custom-domains',
  },
  {
    name: 'Rate Limiting',
    slug: 'rate-limiting',
    route: 'rate-limiting',
  },
  { name: 'AI', slug: 'ai', route: 'ai' },
  {
    name: 'OAuth2 Provider',
    slug: 'oauth2-provider',
    route: 'oauth2-provider',
  },
  { name: 'Observability', slug: 'metrics', route: 'metrics' },
  { name: 'Configuration Editor', slug: 'editor', route: 'editor' },
].map((item) => ({
  label: item.name,
  value: item.slug,
  route: item.route,
}));

export default function ProjectSettingsPagesComboBox() {
  const {
    query: { orgSlug, appSubdomain },
    push,
    asPath,
  } = useRouter();
  const isPlatform = useIsPlatform();
  const { auth } = useSoftwareVersionsInfo();

  const isOAuth2Available =
    !isPlatform ||
    isVersionGte(auth.configuredVersion, MIN_AUTH_VERSION_OAUTH2);

  const projectSettingsPages = useMemo(
    () =>
      allProjectSettingsPages.filter(
        (page) => page.value !== 'oauth2-provider' || isOAuth2Available,
      ),
    [isOAuth2Available],
  );

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const isSettingsPage = pathSegments.includes('settings');
  const settingsPageFromUrl = isSettingsPage
    ? pathSegments[6] || 'general'
    : null;

  const selectedSettingsPage = projectSettingsPages.find(
    (item) => item.value === settingsPageFromUrl,
  );

  const options = projectSettingsPages.map((page) => ({
    label: page.label,
    value: page.value,
  }));

  return (
    <Combobox
      options={options}
      value={selectedSettingsPage?.value ?? null}
      placeholder="Select a page"
      searchPlaceholder="Select a page..."
      className="justify-start gap-2 bg-background text-foreground hover:bg-accent dark:hover:bg-muted"
      onChange={(value) => {
        const option = projectSettingsPages.find(
          (page) => page.value === value,
        );
        if (option) {
          push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/settings/${option.route}/`,
          );
        }
      }}
    />
  );
}
