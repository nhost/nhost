import { useRouter } from 'next/router';
import { useMemo } from 'react';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';

const projectGraphQLPages = [
  {
    name: 'Playground',
    slug: 'playground',
    route: '',
  },
  {
    name: 'Remote Schemas',
    slug: 'remote-schemas',
    route: 'remote-schemas',
  },
  {
    name: 'Actions',
    slug: 'actions',
    route: 'actions',
  },
  {
    name: 'Metadata',
    slug: 'metadata',
    route: 'metadata',
  },
].map((item) => ({
  label: item.name,
  value: item.slug,
  route: item.route,
}));

export default function ProjectGraphQLPagesComboBox() {
  const {
    query: { orgSlug, appSubdomain },
    push,
    asPath,
  } = useRouter();

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const isGraphQLPage = pathSegments.includes('graphql');
  const graphQLPageFromUrl = isGraphQLPage
    ? pathSegments[6] || 'playground'
    : null;

  const selectedGraphQLPage = projectGraphQLPages.find(
    (item) => item.value === graphQLPageFromUrl,
  );

  const options = projectGraphQLPages.map((page) => ({
    label: page.label,
    value: page.value,
  }));

  return (
    <HeaderCombobox
      options={options}
      value={selectedGraphQLPage?.value ?? null}
      placeholder="Select a page"
      searchPlaceholder="Select a page..."
      onChange={(value) => {
        const option = projectGraphQLPages.find((page) => page.value === value);
        if (option) {
          push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/graphql/${option.route}/`,
          );
        }
      }}
    />
  );
}
