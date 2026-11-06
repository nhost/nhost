import { HardDriveIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import { EmptyState } from '@/components/common/EmptyState';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import { DataGridQueryParamsProvider } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { FilesDataGrid } from '@/features/orgs/projects/storage/dataGrid/components/FilesDataGrid';
import { useGetBucketQuery } from '@/generated/graphql';

export default function Bucket() {
  const {
    query: { bucketId: bucketIdParam },
  } = useRouter();

  // catch-all route returns an array of path segments; join them to reconstruct
  // bucket IDs that contain slashes (e.g. "foo/bar")
  const bucketId = Array.isArray(bucketIdParam)
    ? bucketIdParam.join('/')
    : bucketIdParam;

  const { data, loading, error } = useGetBucketQuery({
    variables: { id: bucketId as string },
    skip: !bucketId,
  });

  if (loading) {
    return (
      <Spinner
        wrapperClassName="flex-row text-[12px] leading-[1.66] font-normal gap-1"
        className="h-4 w-4 justify-center"
      >
        Loading bucket...
      </Spinner>
    );
  }

  if (error) {
    throw error;
  }

  if (!data?.bucket) {
    return (
      <EmptyState
        icon={HardDriveIcon}
        title="Bucket not found"
        description={
          <p>
            Bucket{' '}
            <InlineCode className="px-1.5 text-sm">{bucketId}</InlineCode> does
            not exist.
          </p>
        }
      />
    );
  }

  return (
    <DataGridQueryParamsProvider
      key={data.bucket.id}
      storageKey={`storage:${data.bucket.id}`}
    >
      <FilesDataGrid bucket={data.bucket} />
    </DataGridQueryParamsProvider>
  );
}
