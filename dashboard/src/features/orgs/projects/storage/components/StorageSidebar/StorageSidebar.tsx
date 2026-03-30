import { useApolloClient } from '@apollo/client';
import { Archive, Plus } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { BucketActions } from '@/features/orgs/projects/storage/components/BucketActions';
import { CreateBucketForm } from '@/features/orgs/projects/storage/components/CreateBucketForm';
import { DeleteBucketDialog } from '@/features/orgs/projects/storage/components/DeleteBucketDialog';
import { EditBucketForm } from '@/features/orgs/projects/storage/components/EditBucketForm';
import { StoragePermissionsButton } from '@/features/orgs/projects/storage/components/StoragePermissionsButton';
import { useBuckets } from '@/features/orgs/projects/storage/hooks/useBuckets';
import { useDeleteOrphanedFiles } from '@/features/orgs/projects/storage/hooks/useDeleteOrphanedFiles';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { useDeleteBucketMutation } from '@/utils/__generated__/graphql';

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

  const apolloClient = useApolloClient();
  const { openDrawer, closeDrawerWithDirtyGuard } = useDialog();
  const { buckets, loading, error } = useBuckets();
  const [deleteBucket] = useDeleteBucketMutation({ client: apolloClient });
  const [bucketToDelete, setBucketToDelete] = useState<string | null>(null);

  const deleteOrphanedFiles = useDeleteOrphanedFiles();

  function openCreateBucketDrawer() {
    openDrawer({
      title: 'Create a New Bucket',
      component: (
        <CreateBucketForm
          apolloClient={apolloClient}
          onCancel={closeDrawerWithDirtyGuard}
          location="drawer"
        />
      ),
    });
  }

  function openEditBucketDrawer(bucketId: string) {
    openDrawer({
      title: 'Edit Bucket',
      component: (
        <EditBucketForm
          bucketId={bucketId}
          apolloClient={apolloClient}
          onCancel={closeDrawerWithDirtyGuard}
          location="drawer"
        />
      ),
    });
  }

  async function handleDeleteBucket() {
    if (!bucketToDelete) {
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await deleteBucket({
          variables: { id: bucketToDelete },
          refetchQueries: ['getBuckets'],
        });
        await deleteOrphanedFiles();
        if (bucketSlug === bucketToDelete) {
          await router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/storage`,
          );
        }
      },
      {
        loadingMessage: 'Deleting bucket...',
        successMessage: 'Bucket has been deleted successfully.',
        errorMessage: 'Failed to delete bucket.',
      },
    );

    setBucketToDelete(null);
  }

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
    <div className="flex h-full flex-col justify-between">
      <div className="flex flex-col px-2">
        <Button
          variant="link"
          className="!text-sm+ mt-1 flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
          onClick={openCreateBucketDrawer}
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
                      <div className="flex w-full items-center">
                        <NextLink
                          className={cn(
                            'flex min-w-0 flex-1 items-center gap-1.5 p-[0.625rem] text-left',
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
                        <BucketActions
                          onEdit={() => openEditBucketDrawer(bucket.id)}
                          onDelete={() => setBucketToDelete(bucket.id)}
                        />
                      </div>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
        {bucketToDelete && (
          <DeleteBucketDialog
            bucketId={bucketToDelete}
            open={!!bucketToDelete}
            onOpenChange={(open) => {
              if (!open) {
                setBucketToDelete(null);
              }
            }}
            onDelete={handleDeleteBucket}
          />
        )}
      </div>
      <div className="box border-t">
        <StoragePermissionsButton />
      </div>
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
