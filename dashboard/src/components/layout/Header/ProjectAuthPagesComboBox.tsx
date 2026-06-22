import { useRouter } from 'next/router';
import { useMemo } from 'react';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import { MIN_AUTH_VERSION_OAUTH2 } from '@/features/orgs/projects/authentication/oauth2/constants';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useSoftwareVersionsInfo } from '@/features/orgs/projects/common/hooks/useSoftwareVersionsInfo';
import { isVersionGte } from '@/utils/compareVersions';

const allProjectAuthPages = [
  {
    name: 'Users',
    slug: 'users',
    route: 'users',
  },
  {
    name: 'OAuth2 Clients',
    slug: 'oauth2-clients',
    route: 'oauth2-clients',
  },
].map((item) => ({
  label: item.name,
  value: item.slug,
  route: item.route,
}));

export default function ProjectAuthPagesComboBox() {
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

  const projectAuthPages = useMemo(
    () =>
      allProjectAuthPages.filter(
        (page) => page.value !== 'oauth2-clients' || isOAuth2Available,
      ),
    [isOAuth2Available],
  );

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const isAuthPage = pathSegments.includes('auth');
  const authPageFromUrl = isAuthPage ? pathSegments[6] || 'users' : null;

  const selectedAuthPage = projectAuthPages.find(
    (item) => item.value === authPageFromUrl,
  );

  const options = projectAuthPages.map((page) => ({
    label: page.label,
    value: page.value,
  }));

  return (
    <HeaderCombobox
      options={options}
      value={selectedAuthPage?.value ?? null}
      placeholder="Select a page"
      searchPlaceholder="Select a page..."
      onChange={(value) => {
        const option = projectAuthPages.find((page) => page.value === value);
        if (option) {
          push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/auth/${option.route}/`,
          );
        }
      }}
    />
  );
}
