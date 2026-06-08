import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { Combobox } from '@/components/ui/v3/combobox';
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
    <Combobox
      options={options}
      value={selectedOrgPage?.value ?? null}
      placeholder="Select a page"
      searchPlaceholder="Select a page..."
      disabled={!isPlatform}
      className="justify-start gap-2 bg-background text-foreground hover:bg-accent dark:hover:bg-muted"
      onChange={(value) => {
        push(`/orgs/${orgSlug}/${value}`);
      }}
    />
  );
}
