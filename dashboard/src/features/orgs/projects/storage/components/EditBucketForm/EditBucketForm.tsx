import type { ApolloClient } from '@apollo/client';
import { useRouter } from 'next/router';
import { useDialog } from '@/components/common/DialogProvider';
import { Spinner } from '@/components/ui/v3/spinner';
import type { BaseBucketFormProps } from '@/features/orgs/projects/storage/components/BaseBucketForm';
import { BaseBucketForm } from '@/features/orgs/projects/storage/components/BaseBucketForm';
import type { BucketFormValues } from '@/features/orgs/projects/storage/components/BaseBucketForm/bucketFormSchema';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetBucketQuery,
  useGetBucketsQuery,
  useUpdateBucketMutation,
} from '@/utils/__generated__/graphql';

export interface EditBucketFormProps
  extends Pick<BaseBucketFormProps, 'onCancel' | 'location'> {
  bucketId: string;
  apolloClient: ApolloClient;
}

export default function EditBucketForm({
  bucketId,
  onCancel,
  location,
  apolloClient,
}: EditBucketFormProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain } = router.query;
  const { closeDrawer } = useDialog();
  const {
    data,
    loading,
    refetch: refetchBucket,
  } = useGetBucketQuery({
    variables: { id: bucketId },
    client: apolloClient,
    fetchPolicy: 'cache-and-network',
  });
  const { refetch: refetchBuckets } = useGetBucketsQuery({
    client: apolloClient,
  });
  const [updateBucket] = useUpdateBucketMutation({
    client: apolloClient,
  });

  if (loading) {
    return (
      <Spinner
        wrapperClassName="flex-row text-[12px] leading-[1.66] font-normal gap-1 p-6"
        className="h-4 w-4 justify-center"
      >
        Loading bucket...
      </Spinner>
    );
  }

  const bucket = data?.bucket;

  if (!bucket) {
    return null;
  }

  const initialValues: BucketFormValues = {
    name: bucket.id,
    minUploadFileSize: bucket.minUploadFileSize,
    maxUploadFileSize: bucket.maxUploadFileSize,
    presignedUrlsEnabled: bucket.presignedUrlsEnabled,
    downloadExpiration: bucket.downloadExpiration,
    cacheControl: bucket.cacheControl ?? '',
  };

  const nameChanged = (name: string) => name !== bucketId;

  async function handleSubmit(values: BucketFormValues) {
    await execPromiseWithErrorToast(
      async () => {
        await updateBucket({
          variables: {
            id: bucketId,
            bucket: {
              id: values.name,
              minUploadFileSize: values.minUploadFileSize,
              maxUploadFileSize: values.maxUploadFileSize,
              presignedUrlsEnabled: values.presignedUrlsEnabled,
              downloadExpiration: values.downloadExpiration,
              cacheControl: values.cacheControl || null,
            },
          },
        });

        if (nameChanged(values.name)) {
          await refetchBuckets();
          closeDrawer();
          await router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/storage/bucket/${values.name}`,
          );
        } else {
          await refetchBucket();
          closeDrawer();
        }
      },
      {
        loadingMessage: 'Updating bucket...',
        successMessage: 'Bucket has been updated successfully.',
        errorMessage: 'Failed to update bucket.',
      },
    );
  }

  return (
    <BaseBucketForm
      onSubmit={handleSubmit}
      onCancel={onCancel}
      initialValues={initialValues}
      submitButtonText="Save"
      location={location}
    />
  );
}
