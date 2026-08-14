import debounce from 'lodash.debounce';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Spinner } from '@/components/ui/v3/spinner';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { cn } from '@/lib/utils';

export default function SelectOrganization() {
  const { orgs, loading } = useOrgs();
  const router = useRouter();

  const organizations = orgs.map((org) => ({
    name: org.name,
    value: `/orgs/${org.slug}`,
  }));

  const [filter, setFilter] = useState('');

  const handleFilterChange = useMemo(
    () =>
      debounce((event: ChangeEvent<HTMLInputElement>) => {
        setFilter(event.target.value);
      }, 200),
    [],
  );

  useEffect(() => () => handleFilterChange.cancel(), [handleFilterChange]);

  const goToOrgPage = async (org: { name: string; value: string }) => {
    const { slug } = router.query;
    await router.push({
      pathname: `${org.value}/${(() => {
        if (!slug) {
          return '';
        }
        return Array.isArray(slug) ? slug.join('/') : slug;
      })()}`,
    });
  };

  const orgsToDisplay = filter
    ? organizations.filter((org) =>
        org.name.toLowerCase().includes(filter.toLowerCase()),
      )
    : organizations;

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-5 py-4">
        <Spinner size="medium" />
        <span className="text-muted-foreground text-sm">
          Loading organizations...
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full flex-col items-start bg-background px-5 py-4">
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col gap-4 py-6 sm:py-14">
        <h1 className="font-medium text-2xl">Select an Organization</h1>

        <div>
          <div className="mb-2 flex w-full">
            <Input
              placeholder="Search..."
              onChange={handleFilterChange}
              wrapperClassName="w-full"
              autoFocus
            />
          </div>
          <RetryableErrorBoundary>
            {orgsToDisplay.length === 0 ? (
              <div className="h-import py-2">
                <p className="text-muted-foreground text-sm">
                  No results found.
                </p>
              </div>
            ) : (
              <ul className="flex h-import flex-col overflow-y-auto rounded-md border">
                {orgsToDisplay.map((org, index) => (
                  <li
                    key={org.value}
                    className={cn(
                      'flex flex-row items-center justify-center gap-4 p-3',
                      index < orgsToDisplay.length - 1 && 'border-b',
                    )}
                  >
                    <div className="flex h-full items-center justify-center">
                      <Image
                        src="/logos/new.svg"
                        alt="Nhost Logo"
                        className="h-10 w-10 rounded-md"
                        width={38}
                        height={38}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate">{org.name}</span>
                      <p className="truncate text-muted-foreground text-sm">
                        {`${org.name} / ${org.name}`}
                      </p>
                    </div>
                    <Button variant="link" onClick={() => goToOrgPage(org)}>
                      Select
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </RetryableErrorBoundary>
        </div>
      </div>
    </div>
  );
}
