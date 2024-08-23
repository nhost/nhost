import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { usePostOrganizationRequestMutation } from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';
import { useEffect, useState, type ReactElement } from 'react';

export default function PostCheckout() {
  const { session_id } = useRouter().query;

  const [res, setRes] = useState('');

  const [postOrganizationRequest] = usePostOrganizationRequestMutation();

  useEffect(() => {
    if (session_id) {
      execPromiseWithErrorToast(
        async () => {
          const { data } = await postOrganizationRequest({
            variables: {
              sessionID: session_id as string,
            },
          });

          setRes(JSON.stringify(data, null, 2));
        },
        {
          loadingMessage: 'Creating new workspace...',
          successMessage: 'The new workspace has been created successfully.',
          errorMessage: 'An error occurred while creating the new workspace.',
        },
      );
    }
  }, [session_id, postOrganizationRequest]);
  return (
    <div className="checkout flex w-screen">
      <pre>
        <code>{res}</code>
      </pre>
    </div>
  );
}

PostCheckout.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="Post Checkout">{page}</AuthenticatedLayout>
  );
};
