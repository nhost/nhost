import { useRouter } from 'next/router';
import { useMemo } from 'react';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

const orgPages = [
  { label: 'Settings', value: 'settings' },
  { label: 'Projects', value: 'projects' },
  { label: 'Members', value: 'members' },
  { label: 'Billing', value: 'billing' },
];

export default function OrgPagesComboBox() {
  const {
    query: { orgSlug },
    push,
    asPath,
  } = useRouter();

  const isPlatform = useIsPlatform();

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const orgPageFromUrl = pathSegments[3] || null;

  const selectedOrgPage = orgPages.find(
    (item) => item.value === orgPageFromUrl,
  );

  const options = orgPages.map((page) => ({
    label: page.label,
    value: page.value,
  }));

  return (
    <HeaderCombobox
      data-testid="org-pages-switcher"
      options={options}
      value={selectedOrgPage?.value ?? null}
      placeholder="Select a page"
      searchPlaceholder="Select a page..."
      disabled={!isPlatform}
      onChange={(value) => {
        push(`/orgs/${orgSlug}/${value}`);
      }}
    />
  );
}
