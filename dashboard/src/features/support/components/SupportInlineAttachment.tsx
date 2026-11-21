import { useMutation, useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import {
  isSupportImage,
  MAX_SUPPORT_ATTACHMENT_SIZE,
  type SupportAttachmentScope,
  saveSupportAttachment,
} from '@/features/support/utils/attachments';
import {
  DashboardSupportInlineAttachmentDocument,
  type DashboardSupportInlineAttachmentQuery,
} from '@/generated/graphql';

interface SupportInlineAttachmentProps {
  id: string;
  scope: SupportAttachmentScope;
  image?: boolean;
  children: ReactNode;
}

export default function SupportInlineAttachment({
  id,
  scope,
  image: embedImage,
  children,
}: SupportInlineAttachmentProps) {
  const { user, role, request, downloadAttachment } = useSupportSession();
  const requestRole = scope.draftId ? 'user' : role;
  const [image, setImage] = useState<{ blob: Blob; url: string }>();
  const [failedURL, setFailedURL] = useState<string>();
  const attachment = useQuery({
    queryKey: [
      'support',
      user?.id,
      requestRole,
      'inline-attachment',
      scope.ticketId,
      scope.draftId,
      id,
      !!embedImage,
    ],
    queryFn: async ({ signal }) => {
      const result = await request<DashboardSupportInlineAttachmentQuery>(
        DashboardSupportInlineAttachmentDocument,
        {
          id,
          scope: scope.ticketId
            ? { ticketID: { _eq: scope.ticketId } }
            : { draftID: { _eq: scope.draftId } },
        },
        signal,
        requestRole,
      );
      const file = result.supportAttachmentUploads[0]?.file;
      if (!file) {
        throw new Error('Attachment unavailable.');
      }
      let blob: Blob | undefined;
      if (embedImage && file.mimeType && isSupportImage(file.mimeType)) {
        const bytes = await downloadAttachment(file.id, requestRole, signal);
        if (
          bytes.type === file.mimeType &&
          bytes.size > 0 &&
          bytes.size <= MAX_SUPPORT_ATTACHMENT_SIZE
        ) {
          blob = bytes;
        }
      }
      return { file, blob };
    },
    enabled: !!user,
    cacheTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  const blob = !attachment.isError ? attachment.data?.blob : undefined;
  useEffect(() => {
    if (!blob) {
      return undefined;
    }
    const url = URL.createObjectURL(blob);
    setImage({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  const download = useMutation({
    mutationFn: async () => {
      const file = attachment.data?.file;
      if (!file || attachment.isError) {
        throw new Error('Attachment unavailable.');
      }
      const bytes = await downloadAttachment(file.id, requestRole);
      saveSupportAttachment(bytes, file.name ?? 'attachment');
    },
  });
  if (attachment.isError) {
    return (
      <span className="text-muted-foreground">
        [Attachment unavailable: {children}]
      </span>
    );
  }
  if (!attachment.data) {
    return (
      <span className="text-muted-foreground">
        [Loading attachment: {children}]
      </span>
    );
  }
  if (blob && image?.blob === blob && image.url !== failedURL) {
    return (
      // biome-ignore lint/performance/noImgElement: Private authenticated blob URLs must not go through the image optimizer.
      <img
        src={image.url}
        alt={
          typeof children === 'string'
            ? children
            : (attachment.data.file.name ?? 'Attachment')
        }
        className="max-h-[32rem] max-w-full rounded object-contain"
        onError={() => setFailedURL(image.url)}
      />
    );
  }
  return (
    <a
      href={`attachment:${id}`}
      aria-disabled={download.status === 'loading'}
      onClick={(event) => {
        event.preventDefault();
        if (download.status === 'loading') {
          return;
        }
        void execPromiseWithErrorToast(() => download.mutateAsync(), {
          loadingMessage: 'Downloading attachment…',
          successMessage: 'Attachment downloaded',
          errorMessage: 'Unable to download this attachment.',
        });
      }}
    >
      {children}
    </a>
  );
}
