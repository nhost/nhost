import { useRouter } from 'next/router';
import { Badge } from '@/components/ui/v3/badge';
import { Combobox } from '@/components/ui/v3/combobox';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';

export default function OrgsComboBox() {
  const { orgs } = useOrgs();
  const isPlatform = useIsPlatform();
  const [, setLastSlug] = useSSRLocalStorage<string | null>('slug', null);

  const {
    query: { orgSlug },
    push,
  } = useRouter();

  const selectedOrg = orgSlug
    ? orgs.find((item) => item.slug === orgSlug)
    : undefined;

  const renderBadge = (plan: string) => {
    if (!isPlatform) {
      return null;
    }

    return (
      <Badge
        variant={plan === 'Starter' ? 'outline' : 'default'}
        className={cn(
          plan === 'Starter' ? 'bg-muted' : '',
          plan === 'Legacy'
            ? 'bg-orange-200 text-foreground hover:bg-orange-200 dark:bg-orange-500'
            : '',
          'hover:none ml-2 h-5 px-[6px] text-[10px]',
        )}
      >
        {plan}
      </Badge>
    );
  };

  const options = orgs.map((org) => ({
    value: org.slug,
    label: org.name,
    render: (
      <div className="flex w-full items-center justify-between">
        <span className="truncate">{org.name}</span>
        {renderBadge(org.plan?.name ?? 'Legacy')}
      </div>
    ),
  }));

  const triggerLabel = selectedOrg ? (
    <div className="flex flex-row items-center justify-center">
      {selectedOrg.name}
      {renderBadge(selectedOrg.plan?.name ?? 'Legacy')}
    </div>
  ) : null;

  return (
    <Combobox
      options={options}
      value={selectedOrg?.slug ?? null}
      triggerLabel={triggerLabel}
      placeholder="Select organization"
      searchPlaceholder="Select organization..."
      className="w-full justify-between gap-2 bg-background text-foreground hover:bg-accent dark:hover:bg-muted"
      onChange={(slug) => {
        setLastSlug(slug);
        push(`/orgs/${slug}/projects`);
      }}
    />
  );
}
