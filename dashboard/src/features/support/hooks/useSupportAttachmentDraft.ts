import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { useSupportSession } from '@/features/support/hooks/useSupportSession';
import {
  attachmentValidationError,
  type SupportAttachmentUploaded,
} from '@/features/support/utils/attachments';
import type { TicketAttachment } from '@/features/support/utils/tickets';
import {
  DashboardCreateSupportAttachmentDraftDocument,
  type DashboardCreateSupportAttachmentDraftMutation,
  DashboardDiscardSupportDraftAttachmentDocument,
  type DashboardDiscardSupportDraftAttachmentMutation,
  DashboardReserveSupportDraftAttachmentDocument,
  type DashboardReserveSupportDraftAttachmentMutation,
  DashboardSupportAttachmentDraftDocument,
  type DashboardSupportAttachmentDraftQuery,
  DashboardSupportDraftAttachmentReservationDocument,
  type DashboardSupportDraftAttachmentReservationQuery,
} from '@/generated/graphql';

type Draft = NonNullable<
  DashboardSupportAttachmentDraftQuery['supportAttachmentDraft']
>;
interface DraftState {
  draft: Draft | null;
  ticketID?: string;
}
interface DraftIdentity {
  id: string;
  organizationID: string;
}
interface DraftUpload {
  id: number;
  file: File;
  reservationID?: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'invalid';
  error?: string;
}
export type DraftFile = TicketAttachment & {
  name: string;
  size?: number | null;
  mimeType?: string | null;
};
type DraftAction =
  | { type: 'upload'; files?: File[]; onUploaded?: SupportAttachmentUploaded }
  | { type: 'remove'; id: number }
  | { type: 'discard'; id: string }
  | { type: 'clear' };

export function useSupportAttachmentDraft(organizationID: string) {
  const { user, request, uploadAttachment } = useSupportSession();
  const client = useQueryClient();
  const [identity, setIdentity] = useState<DraftIdentity | null>(null);
  const [uploads, setUploads] = useState<DraftUpload[]>([]);
  const [submissionUncertain, setSubmissionUncertain] = useState(false);
  const nextID = useRef(0);
  const queryPrefix = ['support', user?.id, 'user', 'attachment-draft'];
  const queryKey = [...queryPrefix, identity?.id];

  async function readDraft(
    id: string,
    signal?: AbortSignal,
  ): Promise<DraftState> {
    const retained: Draft['uploads'] = [];
    const completed: Draft['attachments'] = [];
    let offset = 0;
    while (true) {
      const result = await request<DashboardSupportAttachmentDraftQuery>(
        DashboardSupportAttachmentDraftDocument,
        { id, offset },
        signal,
        'user',
      );
      const ticket = result.supportTickets[0];
      if (ticket) {
        return { draft: null, ticketID: ticket.id as string };
      }
      const data = result.supportAttachmentDraft;
      if (!data || data.organizationID !== organizationID) {
        throw new Error(
          'This attachment draft is no longer accessible. Keep this submission token and retry; a missing draft does not confirm that submission failed.',
        );
      }
      retained.push(...data.uploads);
      completed.push(...data.attachments);
      if (data.uploads.length < 100 && data.attachments.length < 100) {
        return {
          draft: { ...data, uploads: retained, attachments: completed },
        };
      }
      offset += 100;
    }
  }

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      if (!identity) {
        throw new Error('No attachment draft has been created.');
      }
      return readDraft(identity.id, signal);
    },
    enabled: !!identity && !!user,
    cacheTime: 0,
    retry: false,
  });

  async function refreshDraft(): Promise<DraftState> {
    if (!identity) {
      throw new Error('No attachment draft has been created.');
    }
    return client.fetchQuery({
      queryKey,
      queryFn: ({ signal }) => readDraft(identity.id, signal),
      staleTime: 0,
      cacheTime: 0,
      retry: false,
    });
  }

  function updateUpload(id: number, changes: Partial<DraftUpload>) {
    setUploads((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  async function discardReservation(id: string): Promise<void> {
    const result =
      await request<DashboardDiscardSupportDraftAttachmentMutation>(
        DashboardDiscardSupportDraftAttachmentDocument,
        { id, at: new Date().toISOString() },
        undefined,
        'user',
      );
    if (result.updateSupportAttachmentUploads?.affected_rows === 1) {
      return;
    }
    // A previous discard may have committed even if its response was lost.
    const state =
      await request<DashboardSupportDraftAttachmentReservationQuery>(
        DashboardSupportDraftAttachmentReservationDocument,
        { id },
        undefined,
        'user',
      );
    if (!state.supportAttachmentUpload?.discardedAt) {
      throw new Error(
        'Unable to discard this upload. Refresh the draft and try again.',
      );
    }
  }

  const action = useMutation({
    retry: false,
    mutationFn: async (operation: DraftAction) => {
      if (operation.type === 'clear') {
        if (submissionUncertain) {
          throw new Error(
            'The previous submission could not be confirmed. Check or retry with this draft before starting another ticket.',
          );
        }
        if (identity) {
          const snapshot = await refreshDraft();
          if (snapshot.ticketID || !snapshot.draft) {
            throw new Error(
              'This draft already created a ticket. Open that ticket instead.',
            );
          }
          for (const item of snapshot.draft.uploads) {
            await discardReservation(item.id);
          }
          const latest = await refreshDraft();
          if (
            latest.ticketID ||
            !latest.draft ||
            latest.draft.uploads.length > 0
          ) {
            throw new Error(
              'Unable to clear these draft attachments. Refresh and try again.',
            );
          }
        }
        setIdentity(null);
        setUploads([]);
        setSubmissionUncertain(false);
        return;
      }
      if (operation.type === 'remove') {
        const item = uploads.find((candidate) => candidate.id === operation.id);
        if (item?.reservationID) {
          await discardReservation(item.reservationID);
        }
        setUploads((current) =>
          current.filter((candidate) => candidate.id !== operation.id),
        );
        return;
      }
      if (operation.type === 'discard') {
        await discardReservation(operation.id);
        setUploads((current) =>
          current.filter(
            (candidate) => candidate.reservationID !== operation.id,
          ),
        );
        return;
      }
      if (!organizationID || submissionUncertain) {
        throw new Error(
          'Select an organization and confirm any previous submission before attaching files.',
        );
      }
      const candidates = operation.files ? addFiles(operation.files) : uploads;
      const queued = candidates.filter(
        (item) => item.status === 'pending' || item.status === 'failed',
      );
      if (queued.length === 0) {
        return;
      }
      let target = identity;
      let state: Draft | undefined;
      if (target) {
        if (target.organizationID !== organizationID) {
          throw new Error(
            'Discard the existing draft before changing organization.',
          );
        }
        state = (await refreshDraft()).draft ?? undefined;
        if (!state) {
          throw new Error('This attachment draft is no longer open.');
        }
      } else {
        const result =
          await request<DashboardCreateSupportAttachmentDraftMutation>(
            DashboardCreateSupportAttachmentDraftDocument,
            { organizationId: organizationID },
            undefined,
            'user',
          );
        if (!result.insertSupportAttachmentDraft) {
          throw new Error('Unable to create an attachment draft.');
        }
        target = {
          id: result.insertSupportAttachmentDraft.id as string,
          organizationID,
        };
        setIdentity(target);
      }
      let failed = 0;
      for (const item of queued) {
        updateUpload(item.id, { status: 'uploading', error: undefined });
        try {
          if (item.reservationID) {
            if (
              state?.attachments.some((file) => file.id === item.reservationID)
            ) {
              updateUpload(item.id, { status: 'uploaded' });
              operation.onUploaded?.(
                {
                  id: item.reservationID,
                  name: item.file.name,
                  mimeType: item.file.type,
                },
                item.file,
              );
              continue;
            }
            await discardReservation(item.reservationID);
          }
          const result =
            await request<DashboardReserveSupportDraftAttachmentMutation>(
              DashboardReserveSupportDraftAttachmentDocument,
              { draftId: target.id },
              undefined,
              'user',
            );
          if (!result.insertSupportAttachmentUpload) {
            throw new Error('Unable to reserve a draft upload.');
          }
          const reservationID = result.insertSupportAttachmentUpload
            .id as string;
          updateUpload(item.id, { reservationID });
          await uploadAttachment(reservationID, item.file, 'user');
          updateUpload(item.id, { status: 'uploaded' });
          operation.onUploaded?.(
            {
              id: reservationID,
              name: item.file.name,
              mimeType: item.file.type,
            },
            item.file,
          );
        } catch (error: unknown) {
          console.error(
            'Draft attachment upload failed',
            error instanceof Error ? error.message : 'Unknown error',
          );
          failed += 1;
          updateUpload(item.id, {
            status: 'failed',
            error:
              'Upload could not be confirmed. Retry or remove this file before creating the ticket.',
          });
        }
      }
      if (failed > 0) {
        throw new Error(
          'Some attachments could not be uploaded. Successful files are kept; retry or remove the failed files.',
        );
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryPrefix }),
  });

  function addFiles(selected: File[]) {
    const items = selected.map((file): DraftUpload => {
      nextID.current += 1;
      const error = attachmentValidationError(file);
      return {
        id: nextID.current,
        file,
        status: error ? 'invalid' : 'pending',
        error,
      };
    });
    setUploads((current) => [...current, ...items]);
    return items;
  }

  async function prepareSubmission(linked: ReadonlySet<string>): Promise<{
    draftID?: string;
    ticketID?: string;
  }> {
    if (action.status === 'loading') {
      throw new Error(
        'Wait for attachment changes to finish before creating the ticket.',
      );
    }
    const snapshot = identity ? await refreshDraft() : null;
    if (snapshot?.ticketID) {
      return { ticketID: snapshot.ticketID };
    }
    const state = snapshot?.draft;
    const completed = new Set(state?.attachments.map((file) => file.id));
    if (
      uploads.some((item) => item.status !== 'uploaded') ||
      state?.uploads.some((item) => !completed.has(item.id))
    ) {
      throw new Error(
        'Upload or remove unfinished attachments before creating the ticket.',
      );
    }
    if (state?.attachments.some((file) => !linked.has(file.id))) {
      throw new Error(
        'Insert or remove attachments that are not in the description before creating the ticket.',
      );
    }
    return identity ? { draftID: identity.id } : {};
  }

  async function recoverSubmission(): Promise<string | undefined> {
    setSubmissionUncertain(true);
    const state = await refreshDraft();
    return state.ticketID;
  }

  const data = query.data?.draft;
  const completedIDs = new Set(data?.attachments.map((item) => item.id));
  const unfinished =
    data?.uploads.filter((item) => !completedIDs.has(item.id)) ?? [];
  const busy = action.status === 'loading';
  const hasFiles = !!identity || uploads.length > 0;
  const ready = !busy && !(identity && (query.isLoading || query.isError));
  // While an attachment action runs the draft is mid-change, so it is only
  // validated once the action has finished.
  const files = useMemo(() => {
    if (busy) {
      return [];
    }
    const current = query.isError ? undefined : query.data?.draft;
    const completed = new Set(current?.attachments.map((item) => item.id));
    const queued = uploads.filter((item) => item.status !== 'uploaded');
    const tracked = new Set(queued.map((item) => item.reservationID));
    return [
      ...queued.map(
        (item): DraftFile => ({
          id: `local-${item.id}`,
          name: item.file.name,
          status: item.status,
        }),
      ),
      ...(current?.uploads ?? [])
        .filter((item) => !completed.has(item.id) && !tracked.has(item.id))
        .map(
          (item): DraftFile => ({
            id: item.id,
            name: 'Unfinished upload',
            status: 'unfinished',
          }),
        ),
      ...(current?.attachments ?? []).map(
        (item): DraftFile => ({
          id: item.id,
          name: item.file?.name || 'attachment',
          size: item.file?.size,
          mimeType: item.file?.mimeType,
          status: 'uploaded',
        }),
      ),
    ];
  }, [busy, query.data, query.isError, uploads]);

  return {
    identity,
    uploads,
    query,
    action,
    addFiles,
    prepareSubmission,
    recoverSubmission,
    submissionUncertain,
    busy,
    hasFiles,
    ready,
    files,
    unfinished,
  };
}

export type SupportAttachmentDraftController = ReturnType<
  typeof useSupportAttachmentDraft
>;
