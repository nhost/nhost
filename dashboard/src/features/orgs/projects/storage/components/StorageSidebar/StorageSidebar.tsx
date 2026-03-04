import { Archive, Plus } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { useGetBucketsQuery } from '@/utils/__generated__/graphql';

interface StorageSidebarContentProps {
  onSidebarItemClick?: VoidFunction;
}

function StorageSidebarContent({
  onSidebarItemClick,
}: StorageSidebarContentProps) {
  const router = useRouter();
  const {
    query: { orgSlug, appSubdomain, bucketId: bucketSlug },
  } = router;

  const { data, loading, error } = useGetBucketsQuery();
  const buckets = data?.buckets || [];

  if (loading) {
    return (
      <Spinner
        wrapperClassName="flex-row text-[12px] leading-[1.66] font-normal gap-1"
        className="h-4 w-4 justify-center"
      >
        Loading buckets...
      </Spinner>
    );
  }

  if (error) {
    throw error;
  }

  return (
    <div className="flex h-full flex-col px-2">
      <Button
        variant="link"
        className="!text-sm+ mt-1 flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
        disabled
      >
        New Bucket <Plus className="h-4 w-4" />
      </Button>
      {buckets.length === 0 && (
        <p className="px-2 py-1.5 text-disabled text-xs">No buckets found.</p>
      )}
      <nav aria-label="Storage navigation">
        {isNotEmptyValue(buckets) && (
          <ul className="w-full max-w-full pb-6">
            {buckets.map((bucket) => {
              const isSelected = bucket.id === bucketSlug;
              return (
                <li className="group pb-1" key={bucket.id}>
                  <Button
                    asChild
                    variant="link"
                    size="sm"
                    className={cn(
                      'flex w-full max-w-full justify-between pl-0 text-sm+ hover:bg-accent hover:no-underline',
                      {
                        'bg-table-selected': isSelected,
                      },
                    )}
                  >
                    <div>
                      <NextLink
                        className={cn(
                          'flex h-full w-full items-center gap-1.5 p-[0.625rem] text-left',
                          {
                            'text-primary-main': isSelected,
                          },
                        )}
                        onClick={() => onSidebarItemClick?.()}
                        href={`/orgs/${orgSlug}/projects/${appSubdomain}/storage/bucket/${bucket.id}`}
                      >
                        <Archive className="h-4 w-4 shrink-0" />
                        <span className="!truncate">{bucket.id}</span>
                      </NextLink>
                    </div>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </div>
  );
}

export default function StorageSidebar() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return null;
  }

  return (
    <FeatureSidebar toggleOffset="left-8">
      {(collapse) => <StorageSidebarContent onSidebarItemClick={collapse} />}
    </FeatureSidebar>
  );
}
