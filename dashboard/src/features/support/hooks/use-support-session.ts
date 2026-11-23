import type { GetFileParams } from '@nhost/nhost-js/storage';
import { type DocumentNode, print } from 'graphql';
import { useSupportView } from '@/features/support/components/SupportViewSwitch';
import {
  attachmentValidationError,
  SUPPORT_ATTACHMENT_BUCKET,
} from '@/features/support/utils/attachments';
import {
  downloadSampleAttachment,
  sampleSupportRequest,
  uploadSampleAttachment,
} from '@/features/support/utils/sample-tickets';
import { useAuth } from '@/providers/Auth';
import { useNhostClient } from '@/providers/nhost';

export type SupportRole = 'user' | 'support_agent';

export function useSupportSession() {
  const { user } = useAuth();
  const nhost = useNhostClient();
  const { isAgent, isSample, useSampleRequests, canViewAsAgent } =
    useSupportView();
  const role: SupportRole =
    isAgent && !(isSample && !useSampleRequests) ? 'support_agent' : 'user';
  const queryKey = [
    'support',
    user?.id,
    useSampleRequests ? 'sample' : role,
  ] as const;

  function assertSession() {
    if (!user || nhost.getUserSession()?.user?.id !== user.id) {
      throw new Error('Your session changed. Please sign in again.');
    }
  }

  async function requestHeaders(requestRole: SupportRole = role) {
    assertSession();
    const activeSession = await nhost.refreshSession(60);
    if (
      !activeSession ||
      activeSession.user?.id !== user?.id ||
      nhost.getUserSession()?.user?.id !== user?.id
    ) {
      throw new Error('Your session changed. Please sign in again.');
    }
    const activeRoles =
      activeSession.decodedToken['https://hasura.io/jwt/claims']?.[
        'x-hasura-allowed-roles'
      ];
    if (
      requestRole === 'support_agent' &&
      (!isAgent ||
        !canViewAsAgent ||
        !Array.isArray(activeRoles) ||
        !activeRoles.includes('support_agent'))
    ) {
      throw new Error('Your support access changed. Please reload this page.');
    }
    // Pin requests to the checked session. Never change the shared client's role.
    return {
      Authorization: `Bearer ${activeSession.accessToken}`,
      'x-hasura-role': requestRole,
    };
  }

  async function request<TData>(
    document: DocumentNode,
    variables: Record<string, unknown>,
    signal?: AbortSignal,
    requestRole: SupportRole = role,
  ): Promise<TData> {
    signal?.throwIfAborted();
    if (useSampleRequests) {
      assertSession();
      return sampleSupportRequest<TData>(document, variables, user!);
    }
    const headers = await requestHeaders(requestRole);
    signal?.throwIfAborted();
    const response = await nhost.graphql.request<TData>(
      { query: print(document), variables },
      {
        headers,
        signal,
      },
    );
    assertSession();
    if (!response.body.data) {
      throw new Error('Support is unavailable. Please try again.');
    }
    return response.body.data;
  }

  async function uploadAttachment(
    id: string,
    file: File,
    requestRole: SupportRole = role,
  ): Promise<void> {
    const validationError = attachmentValidationError(file);
    if (validationError) {
      throw new Error(validationError);
    }
    if (useSampleRequests) {
      assertSession();
      uploadSampleAttachment(user!, id, file);
      return;
    }
    const headers = await requestHeaders(requestRole);
    const response = await nhost.storage.uploadFiles(
      {
        'bucket-id': SUPPORT_ATTACHMENT_BUCKET,
        'metadata[]': [{ id }],
        'file[]': [file],
      },
      { headers },
    );
    assertSession();
    if (
      !response.body.processedFiles.some(
        (uploaded) =>
          uploaded.id === id &&
          uploaded.bucketId === SUPPORT_ATTACHMENT_BUCKET &&
          uploaded.isUploaded,
      )
    ) {
      throw new Error(
        'The file upload could not be confirmed. Refresh attachments before retrying.',
      );
    }
  }

  async function downloadAttachment(
    id: string,
    requestRole: SupportRole = role,
    signal?: AbortSignal,
    transform?: GetFileParams,
  ): Promise<Blob> {
    signal?.throwIfAborted();
    if (useSampleRequests) {
      assertSession();
      return downloadSampleAttachment(user!, id, transform);
    }
    const headers = await requestHeaders(requestRole);
    signal?.throwIfAborted();
    const response = await nhost.storage.getFile(id, transform, {
      headers,
      cache: 'no-store',
      signal,
    });
    assertSession();
    return response.body;
  }

  return {
    user,
    isAgent,
    isSample,
    role,
    queryKey,
    request,
    uploadAttachment,
    downloadAttachment,
  };
}
