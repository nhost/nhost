import { FolderX } from 'lucide-react';
import { useRouter } from 'next/router';
import { InlineCode } from '@/components/presentational/InlineCode';
import { Spinner } from '@/components/ui/v3/spinner';
import { FilesDataGrid } from '@/features/orgs/projects/storage/dataGrid/components/FilesDataGrid';
import { useGetBucketQuery } from '@/utils/__generated__/graphql';

export default function Bucket() {
  const {
    query: { bucketId },
  } = useRouter();

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
      <div className="grid w-full place-content-center gap-2 px-4 py-16 text-center">
        <FolderX className="mx-auto h-[72px] w-[72px] text-muted-foreground" />
        <h1 className="!leading-6 font-inter-var font-medium text-[1.125rem]">
          Bucket not found
        </h1>
        <p>
          Bucket <InlineCode className="px-1.5 text-sm">{bucketId}</InlineCode>{' '}
          does not exist.
        </p>
      </div>
    );
  }

  return <FilesDataGrid bucket={data.bucket} />;
}
