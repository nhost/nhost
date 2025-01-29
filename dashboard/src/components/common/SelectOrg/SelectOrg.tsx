import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import {} from '@/utils/__generated__/graphql';
import { Divider } from '@mui/material';
import debounce from 'lodash.debounce';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { ChangeEvent } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';

export default function SelectOrganizationAndProject() {
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
      <div className="flex w-full justify-center">
        <ActivityIndicator delay={500} label="Loading organizations..." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full flex-col items-start bg-background px-5 py-4">
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col gap-4 py-6 sm:py-14">
        <Text variant="h2" component="h1" className="">
          Select an Organization
        </Text>

        <div>
          <div className="mb-2 flex w-full">
            <Input
              placeholder="Search..."
              onChange={handleFilterChange}
              fullWidth
              autoFocus
            />
          </div>
          <RetryableErrorBoundary>
            {orgsToDisplay.length === 0 ? (
              <Box className="h-import py-2">
                <Text variant="subtitle2">No results found.</Text>
              </Box>
            ) : (
              <List className="h-import overflow-y-auto">
                {orgsToDisplay.map((org, index) => (
                  <Fragment key={org.value}>
                    <ListItem.Root
                      className="grid grid-flow-col justify-start gap-2 py-2.5"
                      secondaryAction={
                        <Button
                          variant="borderless"
                          color="primary"
                          onClick={() => goToOrgPage(org)}
                        >
                          Select
                        </Button>
                      }
                    >
                      <ListItem.Avatar>
                        <span className="inline-block h-6 w-6 overflow-hidden rounded-md">
                          <Image
                            src="/logos/new.svg"
                            alt="Nhost Logo"
                            width={24}
                            height={24}
                          />
                        </span>
                      </ListItem.Avatar>
                      <ListItem.Text
                        primary={org.name}
                        secondary={`${org.name} / ${org.name}`}
                      />
                    </ListItem.Root>

                    {index < orgs.length - 1 && <Divider component="li" />}
                  </Fragment>
                ))}
              </List>
            )}
          </RetryableErrorBoundary>
        </div>
      </div>
    </div>
  );
}
