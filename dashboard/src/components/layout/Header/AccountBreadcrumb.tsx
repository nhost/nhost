import Link from 'next/link';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';

/**
 * Header navigation on the account settings page: "{organization} / Account
 * settings". The organization is the one the dashboard would open (the same
 * rule as the home page), and clicking it goes back there.
 */
export default function AccountBreadcrumb() {
  const { orgs } = useOrgs();
  const [lastSlug] = useSSRLocalStorage<string | null>('slug', null);
  const org =
    orgs.find(({ slug }) => slug === lastSlug) ||
    orgs.find(({ plan }) => plan.isFree) ||
    orgs[0];

  return (
    <div className="flex min-w-0 items-center gap-2 px-3 text-sm">
      {org && (
        <>
          <Link
            href={`/orgs/${org.slug}/projects`}
            className="truncate font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {org.name}
          </Link>
          <span aria-hidden="true" className="text-muted-foreground">
            /
          </span>
        </>
      )}
      <span className="whitespace-nowrap font-medium">Account settings</span>
    </div>
  );
}
