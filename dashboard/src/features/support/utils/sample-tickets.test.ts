import {
  downloadSampleAttachment,
  resetSampleTickets,
  sampleSupportRequest,
  uploadSampleAttachment,
} from '@/features/support/utils/sample-tickets';
import {
  DashboardReplyToSupportTicketDocument,
  DashboardReserveSupportAttachmentDocument,
  type DashboardReserveSupportAttachmentMutation,
  DashboardSupportAttachmentsDocument,
  type DashboardSupportAttachmentsQuery,
  DashboardSupportCommentsDocument,
  type DashboardSupportCommentsQuery,
  DashboardSupportInlineAttachmentDocument,
  type DashboardSupportInlineAttachmentQuery,
  DashboardSupportOrganizationsDocument,
  DashboardSupportTicketDocument,
  type DashboardSupportTicketQuery,
  DashboardSupportTicketsDocument,
  type DashboardSupportTicketsQuery,
  DashboardUpdateSupportTicketDocument,
  type DashboardUpdateSupportTicketMutation,
  SupportSeverities_Enum,
  SupportTicketStatuses_Enum,
} from '@/generated/graphql';

const actor = {
  id: 'a0000000-0000-4000-8000-000000000001',
  displayName: 'Designer',
};
const otherActor = {
  id: 'a0000000-0000-4000-8000-000000000002',
  displayName: 'Other designer',
};
function tickets() {
  return sampleSupportRequest<DashboardSupportTicketsQuery>(
    DashboardSupportTicketsDocument,
    { where: {}, offset: 0 },
    actor,
  ).supportTickets;
}
function detail(id: string, who = actor) {
  return sampleSupportRequest<DashboardSupportTicketQuery>(
    DashboardSupportTicketDocument,
    { id },
    who,
  ).supportTicket!;
}
beforeEach(() => {
  resetSampleTickets(actor.id);
  resetSampleTickets(otherActor.id);
});

describe('browser-only sample Support', () => {
  it('covers every status, severity, both organizations and assignment states', () => {
    const rows = tickets();
    expect(rows).toHaveLength(25);
    const nextPage = sampleSupportRequest<
      DashboardSupportTicketsQuery & { sampleTicketCount: number }
    >(DashboardSupportTicketsDocument, { where: {}, offset: 25 }, actor);
    expect(nextPage.sampleTicketCount).toBe(32);
    expect(nextPage.supportTickets).toHaveLength(7);
    expect(new Set(rows.map((ticket) => ticket.status)).size).toBe(6);
    expect(new Set(rows.map((ticket) => ticket.severity)).size).toBe(4);
    expect(new Set(rows.map((ticket) => ticket.organizationID)).size).toBe(2);
    expect(new Set(rows.map((ticket) => ticket.assigneeID)).size).toBe(3);
    expect(rows.some((ticket) => ticket.assigneeID === null)).toBe(true);
  });

  it('filters titles, organizations, statuses and agent queues', () => {
    const response = sampleSupportRequest<DashboardSupportTicketsQuery>(
      DashboardSupportTicketsDocument,
      {
        where: {
          _and: [
            { title: { _ilike: '%Postgres%' } },
            { organizationName: { _ilike: '%Northstar%' } },
            { assigneeID: { _eq: actor.id } },
            { status: { _nin: ['closed', 'resolved'] } },
          ],
        },
        offset: 0,
      },
      actor,
    );
    expect(response.supportTickets).toHaveLength(1);
    expect(response.supportTickets[0].title).toContain('Postgres');
  });

  it('changes status, severity and assignment without affecting another user’s sandbox', () => {
    const row = tickets().find(
      (ticket) => ticket.status === SupportTicketStatuses_Enum.New,
    )!;
    const response = sampleSupportRequest<DashboardUpdateSupportTicketMutation>(
      DashboardUpdateSupportTicketDocument,
      {
        id: row.id,
        version: row.version,
        changes: {
          status: SupportTicketStatuses_Enum.InProgress,
          severity: SupportSeverities_Enum.Urgent,
          assigneeID: null,
        },
      },
      actor,
    );
    expect(response.updateSupportTickets?.affected_rows).toBe(1);
    expect(detail(row.id)).toMatchObject({
      status: 'in_progress',
      severity: 'urgent',
      assigneeID: null,
      version: 2,
    });
    expect(detail(row.id, otherActor)).toMatchObject({
      status: 'new',
      severity: 'low',
      version: 1,
    });
    resetSampleTickets(actor.id);
    expect(detail(row.id)).toMatchObject({
      status: 'new',
      severity: 'low',
      version: 1,
    });
  });

  it('keeps replies and image attachments in memory, with ticket-scoped reads', async () => {
    const row = tickets().find(
      (ticket) => ticket.status === SupportTicketStatuses_Enum.New,
    )!;
    const before = sampleSupportRequest<DashboardSupportCommentsQuery>(
      DashboardSupportCommentsDocument,
      { id: row.id, offset: 0 },
      actor,
    );
    expect(before.supportComments).toHaveLength(4);
    expect(
      before.supportComments.some((comment) =>
        comment.body.includes('![Connection chart]'),
      ),
    ).toBe(true);
    sampleSupportRequest(
      DashboardReplyToSupportTicketDocument,
      { ticketId: row.id, body: 'Thanks, this helps.' },
      actor,
    );
    const after = sampleSupportRequest<DashboardSupportCommentsQuery>(
      DashboardSupportCommentsDocument,
      { id: row.id, offset: 0 },
      actor,
    );
    expect(after.supportComments[0].body).toBe('Thanks, this helps.');
    const attachments = sampleSupportRequest<DashboardSupportAttachmentsQuery>(
      DashboardSupportAttachmentsDocument,
      { ticketId: row.id, offset: 0 },
      actor,
    );
    const file = attachments.supportTicket!.attachments[0].file!;
    const blob = await downloadSampleAttachment(actor, file.id);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
    const wrongScope =
      sampleSupportRequest<DashboardSupportInlineAttachmentQuery>(
        DashboardSupportInlineAttachmentDocument,
        { id: file.id, scope: { ticketID: { _eq: 'not-this-ticket' } } },
        actor,
      );
    expect(wrongScope.supportAttachmentUploads).toEqual([]);
  });

  it('uploads only into its own sample reservations and fails closed for real IDs and unknown operations', async () => {
    const row = tickets().find(
      (ticket) => ticket.status === SupportTicketStatuses_Enum.New,
    )!;
    const reservation =
      sampleSupportRequest<DashboardReserveSupportAttachmentMutation>(
        DashboardReserveSupportAttachmentDocument,
        { ticketId: row.id },
        actor,
      );
    const id = reservation.insertSupportAttachmentUpload!.id;
    const file = new File(['sample log'], 'log.txt', { type: 'text/plain' });
    uploadSampleAttachment(actor, id, file);
    expect(await downloadSampleAttachment(actor, id)).toBe(file);
    expect(() => uploadSampleAttachment(actor, 'real-file-id', file)).toThrow(
      'reservation not found',
    );
    await expect(
      downloadSampleAttachment(actor, 'real-file-id'),
    ).rejects.toThrow('unavailable');
    expect(() =>
      sampleSupportRequest(DashboardSupportOrganizationsDocument, {}, actor),
    ).toThrow('not available in sample');
    const missing = sampleSupportRequest<DashboardSupportTicketQuery>(
      DashboardSupportTicketDocument,
      { id: 'real-ticket-id' },
      actor,
    );
    expect(missing.supportTicket).toBeNull();
  });
});
