import { useRouter } from 'next/router';
import { useMemo } from 'react';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';

type Option = {
  value: string;
  label: string;
  route: string;
};

const projectDatabasePages: Option[] = [
  {
    label: 'Table Editor & Browser',
    value: 'browser',
    route: 'database/browser/default',
  },
  {
    label: 'Schema Navigator',
    value: 'schema',
    route: 'database/schema/default',
  },
];

export default function ProjectDatabasePagesComboBox() {
  const {
    query: { orgSlug, appSubdomain },
    push,
    asPath,
  } = useRouter();

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const isDatabasePage = pathSegments[5] === 'database';
  const databasePageFromUrl = isDatabasePage
    ? pathSegments[6] || 'browser'
    : null;

  const selectedDatabasePage = useMemo(
    () =>
      projectDatabasePages.find((item) => item.value === databasePageFromUrl) ??
      null,
    [databasePageFromUrl],
  );

  const options = projectDatabasePages.map((page) => ({
    label: page.label,
    value: page.value,
  }));

  return (
    <HeaderCombobox
      options={options}
      value={selectedDatabasePage?.value ?? null}
      placeholder="Select a page"
      searchPlaceholder="Select a page..."
      onChange={(value) => {
        const option = projectDatabasePages.find(
          (page) => page.value === value,
        );
        if (option) {
          push(`/orgs/${orgSlug}/projects/${appSubdomain}/${option.route}`);
        }
      }}
    />
  );
}
