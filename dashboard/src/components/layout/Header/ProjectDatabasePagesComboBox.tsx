import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { Combobox } from '@/components/ui/v3/combobox';

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
    <Combobox
      options={options}
      value={selectedDatabasePage?.value ?? null}
      placeholder="Select a page"
      searchPlaceholder="Select a page..."
      className="justify-start gap-2 bg-background text-foreground hover:bg-accent dark:hover:bg-muted"
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
