import type { ApolloClient } from '@apollo/client';
import { useRouter } from 'next/router';
import { useDialog } from '@/components/common/DialogProvider';
import type { BaseBucketFormProps } from '@/features/orgs/projects/storage/components/BaseBucketForm';
import { BaseBucketForm } from '@/features/orgs/projects/storage/components/BaseBucketForm';
import type { BucketFormValues } from '@/features/orgs/projects/storage/components/BaseBucketForm/bucketFormSchema';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetBucketsQuery,
  useInsertBucketMutation,
} from '@/utils/__generated__/graphql';

export interface CreateBucketFormProps
  extends Pick<BaseBucketFormProps, 'onCancel' | 'location'> {
  apolloClient: ApolloClient;
}

export default function CreateBucketForm({
  onCancel,
  location,
  apolloClient,
}: CreateBucketFormProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain } = router.query;
  const { closeDrawer } = useDialog();
  const { refetch: refetchBuckets } = useGetBucketsQuery({
    client: apolloClient,
  });
  const [insertBucket] = useInsertBucketMutation({
    client: apolloClient,
  });

  async function handleSubmit(values: BucketFormValues) {
    await execPromiseWithErrorToast(
      async () => {
        await insertBucket({
          variables: {
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

        await refetchBuckets();
        closeDrawer();

        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/storage/bucket/${values.name}`,
        );
      },
      {
        loadingMessage: 'Creating bucket...',
        successMessage: 'Bucket has been created successfully.',
        errorMessage: 'Failed to create bucket.',
      },
    );
  }

  return (
    <BaseBucketForm
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitButtonText="Create"
      location={location}
    />
  );
}
