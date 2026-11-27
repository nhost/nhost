import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useSupportSession } from '@/features/support/hooks/useSupportSession';
import {
  attachmentValidationError,
  type SupportAttachmentUploaded,
  saveSupportAttachment,
} from '@/features/support/utils/attachments';
import {
  DashboardReserveSupportAttachmentDocument,
  type DashboardReserveSupportAttachmentMutation,
  DashboardSupportAttachmentsDocument,
  type DashboardSupportAttachmentsQuery,
} from '@/generated/graphql';

interface AttachmentUpload {
  id: number;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'invalid';
  error?: string;
}

export type SupportTicketAttachment = NonNullable<
  DashboardSupportAttachmentsQuery['supportTicket']
>['attachments'][number];

// Every completed attachment of the ticket, all 100-row pages. Messages resolve
// their attachment references against this list instead of querying per file.
export function useSupportTicketAttachmentList(
  ticketId: string | undefined,
  refetchOnMount = true,
) {
  const { user, queryKey, request } = useSupportSession();
  return useQuery({
    queryKey: [...queryKey, 'attachments', ticketId],
    queryFn: async ({ signal }) => {
      const attachments: SupportTicketAttachment[] = [];
      for (let offset = 0; ; offset += 100) {
        const result = await request<DashboardSupportAttachmentsQuery>(
          DashboardSupportAttachmentsDocument,
          { ticketId, offset },
          signal,
        );
        if (!result.supportTicket) {
          throw new Error('This ticket is no longer accessible.');
        }
        attachments.push(...result.supportTicket.attachments);
        if (result.supportTicket.attachments.length < 100) {
          return attachments;
        }
      }
    },
    enabled: !!user && !!ticketId,
    cacheTime: 0,
    retry: false,
    refetchOnMount,
  });
}

export function useSupportTicketAttachments(
  ticketId: string,
  closed: boolean,
  disabled: boolean,
) {
  const { queryKey, request, uploadAttachment, downloadAttachment } =
    useSupportSession();
  const client = useQueryClient();
  const nextUploadId = useRef(0);
  const [uploads, setUploads] = useState<AttachmentUpload[]>([]);
  const attachmentsKey = [...queryKey, 'attachments', ticketId];
  const attachments = useSupportTicketAttachmentList(ticketId);
  function updateUpload(id: number, changes: Partial<AttachmentUpload>) {
    setUploads((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, ...changes } : candidate,
      ),
    );
  }
  const upload = useMutation({
    retry: false,
    mutationFn: async (operation: {
      files?: File[];
      onUploaded?: SupportAttachmentUploaded;
    }) => {
      const selected = operation.files;
      if (closed || disabled || attachments.isError || attachments.isLoading) {
        throw new Error(
          'Attachments cannot be uploaded to this ticket right now.',
        );
      }
      const candidates = selected
        ? selected.map((file): AttachmentUpload => {
            const error = attachmentValidationError(file);
            nextUploadId.current += 1;
            return {
              id: nextUploadId.current,
              file,
              status: error ? 'invalid' : 'pending',
              error,
            };
          })
        : uploads;
      if (selected) {
        setUploads((current) => [...current, ...candidates]);
      }
      let failed = 0;
      // One file per request preserves per-file outcomes without multipart ambiguity.
      for (const item of candidates.filter(
        (candidate) =>
          candidate.status === 'pending' || candidate.status === 'failed',
      )) {
        updateUpload(item.id, { status: 'uploading', error: undefined });
        try {
          const reservation =
            await request<DashboardReserveSupportAttachmentMutation>(
              DashboardReserveSupportAttachmentDocument,
              { ticketId },
            );
          if (!reservation.insertSupportAttachmentUpload) {
            throw new Error('Unable to reserve an upload ID.');
          }
          await uploadAttachment(
            reservation.insertSupportAttachmentUpload.id,
            item.file,
          );
          updateUpload(item.id, { status: 'uploaded' });
          operation.onUploaded?.(
            {
              id: reservation.insertSupportAttachmentUpload.id,
              name: item.file.name,
              mimeType: item.file.type,
            },
            item.file,
          );
        } catch (error: unknown) {
          console.error(
            'Support attachment upload failed',
            error instanceof Error ? error.message : 'Unknown error',
          );
          failed += 1;
          updateUpload(item.id, {
            status: 'failed',
            error:
              'Upload could not be confirmed. Check the attachment list before retrying.',
          });
        }
      }
      if (failed > 0) {
        throw new Error(
          `${failed} file upload(s) could not be confirmed. Successful files are kept. Check attachments before retrying the failed files.`,
        );
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: attachmentsKey }),
  });
  const download = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const blob = await downloadAttachment(id);
      saveSupportAttachment(blob, name);
    },
  });
  const uploading = upload.isPending;
  return {
    attachments,
    uploads,
    download,
    uploading,
    unavailable:
      closed ||
      disabled ||
      uploading ||
      attachments.isError ||
      attachments.isLoading,
    files: attachments.data ?? [],
    uploadFiles: (files?: File[], onUploaded?: SupportAttachmentUploaded) =>
      execPromiseWithErrorToast(
        () => upload.mutateAsync({ files, onUploaded }),
        {
          loadingMessage: 'Uploading files…',
          successMessage: 'Files uploaded',
          errorMessage: 'Unable to upload files.',
        },
      ),
    removeUpload: (id: number) => {
      if (!uploading) {
        setUploads((current) =>
          current.filter((candidate) => candidate.id !== id),
        );
      }
    },
  };
}

export type SupportTicketAttachmentsController = ReturnType<
  typeof useSupportTicketAttachments
>;
