import { useNavigate, useParams } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import OrganizationLabel from '@/components/layout/Header/OrganizationLabel';
import OrganizationPlanBadge from '@/components/layout/Header/OrganizationPlanBadge';
import { CommandItem, CommandSeparator } from '@/components/ui/v3/command';
import { openCreateOrgDialog } from '@/features/orgs/components/CreateOrgFormDialog/createOrgDialogStore';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';

export default function OrganizationsCombobox() {
  const { orgs } = useOrgs();
  const [, setLastSlug] = useSSRLocalStorage<string | null>('slug', null);

  const { orgSlug } = useParams({ strict: false });
  const navigate = useNavigate();

  const selectedOrg = orgSlug
    ? orgs.find((item) => item.slug === orgSlug)
    : undefined;

  const options = orgs.map((org) => ({
    value: org.slug,
    label: org.name,
    render: (
      <div className="flex w-full items-center justify-between">
        <span className="truncate">{org.name}</span>
        <OrganizationPlanBadge plan={org.plan?.name} />
      </div>
    ),
  }));

  const selectedLabel = selectedOrg ? (
    <OrganizationLabel organization={selectedOrg} />
  ) : null;

  const footerSlot = (
    <>
      <CommandSeparator className="mt-1" />
      <CommandItem
        forceMount
        value="new-organization"
        onSelect={openCreateOrgDialog}
      >
        <Plus className="mr-2 h-4 w-4" />
        New Organization
      </CommandItem>
    </>
  );

  return (
    <HeaderCombobox
      data-testid="org-switcher"
      options={options}
      value={selectedOrg?.slug ?? null}
      placeholder="Select organization"
      searchPlaceholder="Select organization..."
      footerSlot={footerSlot}
      linkHref={selectedOrg ? `/orgs/${selectedOrg.slug}/projects` : undefined}
      linkContent={selectedLabel}
      aria-label="Switch organization"
      onChange={(slug) => {
        setLastSlug(slug);
        navigate({ to: '/orgs/$orgSlug/projects', params: { orgSlug: slug } });
      }}
    />
  );
}
