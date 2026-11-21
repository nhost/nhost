import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import NewTicket from '@/features/support/components/NewTicket';
import { useSupportAttachmentDraft } from '@/features/support/hooks/use-support-attachment-draft';
import { SUPPORT_ATTACHMENT_BUCKET } from '@/features/support/utils/attachments';
import type {
  DashboardSupportAttachmentDraftQuery,
  SupportTickets_Insert_Input,
} from '@/generated/graphql';
import { mockMultipartFormData } from '@/tests/mock-multipart-form-data';
import { mockMatchMediaValue, mockRouter, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  act,
  fireEvent,
  mockScrollIntoViewAndPointerCapture,
  Providers,
  queryClient,
  render,
  renderHook,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

type Draft = NonNullable<
  DashboardSupportAttachmentDraftQuery['supportAttachmentDraft']
>;
interface Reservation {
  id: string;
  name: string;
  mimeType: string;
  completed: boolean;
  discarded: boolean;
  draftID: string | null;
  ticketID: string | null;
}
interface RequestLog {
  operation: string;
  role: string | null;
  variables: Record<string, unknown>;
}
const router = vi.hoisted(() => ({
  push: vi.fn().mockResolvedValue(true),
  useRouter: vi.fn(),
}));
vi.mock('next/router', () => ({ useRouter: router.useRouter }));
const organizationID = '0d9c1e17-4983-4d38-b793-1be03368bec1';
const otherOrganizationID = '28ba74e2-b51a-4875-8913-9339a6da5026';
const draftID = '87892ee8-df02-4292-9f38-9e288ef1e686';
const ticketID = '7d442aba-6e61-4854-b354-0d5ec8d198d8';
const originalClaims = structuredClone(mockSession.decodedToken);
const originalToken = mockSession.accessToken;
let draft: Draft | null;
let submittedTicket: { id: string; attachmentDraftID: string } | null;
let denyTicketReads: boolean;
let failTicketInsert: boolean;
let deferSubmission: boolean;
let records: Reservation[];
let requests: RequestLog[];
let storageRequests: {
  id: string;
  name: string;
  bucket: FormDataEntryValue | null;
  role: string | null;
  authorization: string | null;
  body: string;
}[];
let failUpload: Set<string>;
let loseUploadResponse: boolean;
let loseReservationResponse: boolean;
let loseSubmissionResponse: boolean;
let failSubmissionRecovery: boolean;
let draftQueryFailures: number;
let denyDraftReads: boolean;
let reservationCounter: number;

function record(
  operation: string,
  request: Request,
  variables: Record<string, unknown>,
) {
  requests.push({
    operation,
    role: request.headers.get('x-hasura-role'),
    variables,
  });
}
function reserve(name = 'Unknown upload'): Reservation {
  reservationCounter += 1;
  const entry = {
    id: `00000000-0000-4000-8000-${String(reservationCounter).padStart(12, '0')}`,
    name,
    mimeType: 'text/plain',
    completed: false,
    discarded: false,
    draftID,
    ticketID: null,
  };
  records.push(entry);
  return entry;
}
function publishDraft(id = draftID) {
  submittedTicket = { id: ticketID, attachmentDraftID: id };
  for (const item of records.filter((entry) => entry.draftID === id)) {
    item.ticketID = ticketID;
    item.draftID = null;
  }
  draft = null;
}
function authorize(agent: boolean) {
  const claims = {
    'x-hasura-user-id': mockSession.user!.id,
    'x-hasura-default-role': 'user',
    'x-hasura-allowed-roles': agent ? ['user', 'support_agent'] : ['user'],
  };
  mockSession.decodedToken = {
    ...originalClaims,
    'https://hasura.io/jwt/claims': claims,
  };
  mockSession.accessToken = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: mockSession.user!.id, exp: Math.floor(Date.now() / 1000) + 3600, 'https://hasura.io/jwt/claims': claims }))}.test-signature`;
}
const server = setupServer(
  http.post('https://local.auth.local.nhost.run/v1/token', () =>
    HttpResponse.json({ ...mockSession }),
  ),
  nhostGraphQLLink.query('dashboardSupportOrganizations', () =>
    HttpResponse.json({
      data: {
        organizations: [
          {
            id: organizationID,
            name: 'Acme',
            plan: {
              supportAllowedSeverities: ['low', 'normal', 'high', 'urgent'],
            },
            apps: [],
          },
          {
            id: otherOrganizationID,
            name: 'Other org',
            plan: { supportAllowedSeverities: ['low'] },
            apps: [],
          },
        ],
      },
    }),
  ),
  nhostGraphQLLink.mutation(
    'dashboardCreateSupportAttachmentDraft',
    ({ request, variables }) => {
      record('draft', request, variables);
      draft = {
        id: draftID,
        organizationID: String(variables.organizationId),
        createdAt: new Date().toISOString(),
        uploads: [],
        attachments: [],
      };
      return HttpResponse.json({
        data: {
          insertSupportAttachmentDraft: {
            id: draft.id,
            createdAt: draft.createdAt,
          },
        },
      });
    },
  ),
  nhostGraphQLLink.query(
    'dashboardSupportAttachmentDraft',
    ({ request, variables }) => {
      record('read', request, variables);
      if (draftQueryFailures > 0) {
        draftQueryFailures -= 1;
        return HttpResponse.json({
          errors: [{ message: 'Draft temporarily unavailable' }],
        });
      }
      const supportTickets =
        submittedTicket &&
        !denyTicketReads &&
        submittedTicket.attachmentDraftID === variables.id
          ? [{ id: submittedTicket.id }]
          : [];
      if (!draft || denyDraftReads) {
        return HttpResponse.json({
          data: { supportAttachmentDraft: null, supportTickets },
        });
      }
      const retained = records.filter(
        (item) => item.draftID === draft?.id && !item.discarded,
      );
      const offset = Number(variables.offset);
      return HttpResponse.json({
        data: {
          supportTickets,
          supportAttachmentDraft: {
            ...draft,
            uploads: retained
              .slice(offset, offset + 100)
              .map((item) => ({ id: item.id })),
            attachments: retained
              .filter((item) => item.completed)
              .slice(offset, offset + 100)
              .map((item) => ({
                id: item.id,
                file: {
                  id: item.id,
                  name: item.name,
                  size: 10,
                  mimeType: item.mimeType,
                },
              })),
          },
        },
      });
    },
  ),
  nhostGraphQLLink.mutation(
    'dashboardReserveSupportDraftAttachment',
    ({ request, variables }) => {
      record('reserve', request, variables);
      const item = reserve();
      if (loseReservationResponse) {
        loseReservationResponse = false;
        return HttpResponse.error();
      }
      return HttpResponse.json({
        data: { insertSupportAttachmentUpload: { id: item.id } },
      });
    },
  ),
  nhostGraphQLLink.mutation(
    'dashboardDiscardSupportDraftAttachment',
    ({ request, variables }) => {
      record('discard', request, variables);
      const entry = records.find((item) => item.id === variables.id);
      const affected_rows = entry && !entry.discarded && draft ? 1 : 0;
      if (entry && affected_rows === 1) {
        entry.discarded = true;
      }
      return HttpResponse.json({
        data: { updateSupportAttachmentUploads: { affected_rows } },
      });
    },
  ),
  nhostGraphQLLink.query(
    'dashboardSupportDraftAttachmentReservation',
    ({ variables }) =>
      HttpResponse.json({
        data: {
          supportAttachmentUpload: {
            discardedAt: records.find((item) => item.id === variables.id)
              ?.discarded
              ? new Date().toISOString()
              : null,
          },
        },
      }),
  ),
  nhostGraphQLLink.mutation(
    'dashboardCreateSupportTicket',
    ({ request, variables }) => {
      record('ticket', request, variables);
      const input = variables.input as SupportTickets_Insert_Input;
      if (input.attachmentDraftID) {
        if (
          failTicketInsert ||
          !draft ||
          submittedTicket ||
          records.some(
            (item) =>
              item.draftID === input.attachmentDraftID &&
              !item.discarded &&
              !item.completed,
          )
        ) {
          return HttpResponse.json({
            errors: [{ message: 'Draft cannot be submitted' }],
          });
        }
        if (deferSubmission) {
          return HttpResponse.error();
        }
        publishDraft(String(input.attachmentDraftID));
      }
      if (loseSubmissionResponse) {
        loseSubmissionResponse = false;
        if (failSubmissionRecovery) {
          draftQueryFailures = 1;
        }
        return HttpResponse.error();
      }
      return HttpResponse.json({
        data: { insertSupportTicket: { id: ticketID } },
      });
    },
  ),
  http.post(
    'https://local.storage.local.nhost.run/v1/files',
    async ({ request }) => {
      const data = await request.formData();
      const metadata = data.get('metadata[]');
      const file = data.get('file[]');
      if (!metadata || !file || typeof file === 'string') {
        return HttpResponse.json(
          { error: { message: 'Invalid upload' } },
          { status: 400 },
        );
      }
      const { id } = JSON.parse(
        typeof metadata === 'string' ? metadata : await metadata.text(),
      ) as { id: string };
      storageRequests.push({
        id,
        name: file.name,
        bucket: data.get('bucket-id'),
        role: request.headers.get('x-hasura-role'),
        authorization: request.headers.get('authorization'),
        body: await file.text(),
      });
      const entry = records.find((item) => item.id === id);
      if (entry) {
        entry.name = file.name;
        entry.mimeType = file.type;
      }
      if (failUpload.delete(file.name)) {
        return HttpResponse.json(
          { error: { message: 'Upload rejected' } },
          { status: 403 },
        );
      }
      if (entry) {
        entry.completed = true;
      }
      if (loseUploadResponse) {
        loseUploadResponse = false;
        return HttpResponse.error();
      }
      return HttpResponse.json(
        {
          processedFiles: [
            { id, bucketId: SUPPORT_ATTACHMENT_BUCKET, isUploaded: true },
          ],
        },
        { status: 201 },
      );
    },
  ),
);

mockMultipartFormData();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  mockScrollIntoViewAndPointerCapture();
  toast.remove();
  queryClient.clear();
  authorize(false);
  router.useRouter.mockReturnValue({ ...mockRouter, push: router.push });
  draft = null;
  submittedTicket = null;
  denyTicketReads = false;
  failTicketInsert = false;
  deferSubmission = false;
  records = [];
  requests = [];
  storageRequests = [];
  failUpload = new Set();
  loseUploadResponse = false;
  loseReservationResponse = false;
  loseSubmissionResponse = false;
  failSubmissionRecovery = false;
  denyDraftReads = false;
  draftQueryFailures = 0;
  reservationCounter = 0;
});
afterEach(() => {
  server.resetHandlers();
  toast.remove();
  queryClient.clear();
  mockSession.accessToken = originalToken;
  mockSession.decodedToken = structuredClone(originalClaims);
  vi.clearAllMocks();
});
afterAll(() => server.close());

async function selectOrganization(user: TestUserEvent, name = 'Acme') {
  await user.click(screen.getByRole('combobox', { name: 'Organization' }));
  await user.click(await screen.findByRole('option', { name }));
}
async function fillForm(user: TestUserEvent) {
  await screen.findByRole('heading', { name: 'Create a support ticket' });
  await selectOrganization(user);
  await user.type(
    screen.getByRole('textbox', { name: 'Title' }),
    'Uploads fail',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    '**Diagnostic details**',
  );
  await user.click(screen.getByRole('checkbox', { name: 'Storage' }));
}
async function uploadFiles(user: TestUserEvent, names = ['logs.txt']) {
  await user.upload(
    screen.getByLabelText('Attach files'),
    names.map(
      (name) => new File(['diagnostic contents'], name, { type: 'text/plain' }),
    ),
  );
}
async function uploaded() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Create ticket' })).toBeEnabled(),
  );
}

describe('new ticket attachment drafts', () => {
  it('automatically uploads files dropped into the description without sending a ticket', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    fireEvent.drop(screen.getByRole('textbox', { name: 'Description' }), {
      dataTransfer: {
        types: ['Files'],
        files: [
          new File(['dropped logs'], 'dropped.txt', { type: 'text/plain' }),
        ],
      },
    });
    await screen.findByRole('button', { name: 'Download dropped.txt' });
    await uploaded();
    expect(storageRequests).toHaveLength(1);
    expect(storageRequests[0]).toMatchObject({
      name: 'dropped.txt',
      body: 'dropped logs',
      role: 'user',
    });
    expect(requests.some((item) => item.operation === 'ticket')).toBe(false);
    expect(
      screen.queryByRole('button', { name: 'Upload files' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
      '**Diagnostic details**',
    );
  });

  it('inserts uploaded file links and images at the description cursor and submits the raw Markdown', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await user.upload(screen.getByLabelText('Attach files'), [
      new File(['logs'], 'logs [safe].txt', { type: 'text/plain' }),
      new File(['image'], 'screenshot.png', { type: 'image/png' }),
    ]);
    await uploaded();
    const editor = screen.getByRole('textbox', {
      name: 'Description',
    }) as HTMLTextAreaElement;
    editor.setSelectionRange(0, 0);
    await user.click(
      screen.getByRole('button', {
        name: 'Insert logs [safe].txt into description',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Insert screenshot.png into description',
      }),
    );
    const markdown = `[logs \\[safe\\].txt](attachment:${records[0].id})![screenshot.png](attachment:${records[1].id})**Diagnostic details**`;
    expect(editor).toHaveValue(markdown);
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(
      requests.find((item) => item.operation === 'ticket')?.variables,
    ).toMatchObject({ input: { description: markdown } });
  });

  it.each([false, true])(
    'uploads before creating the ticket, always as user (agent=%s)',
    async (agent) => {
      authorize(agent);
      const user = new TestUserEvent();
      render(<NewTicket />);
      await fillForm(user);
      await uploadFiles(user);
      await uploaded();
      expect(
        requests.filter((item) => item.operation === 'ticket'),
      ).toHaveLength(0);
      expect(requests.find((item) => item.operation === 'draft')).toMatchObject(
        { role: 'user', variables: { organizationId: organizationID } },
      );
      expect(
        requests.find((item) => item.operation === 'reserve'),
      ).toMatchObject({ role: 'user', variables: { draftId: draftID } });
      expect(storageRequests).toEqual([
        {
          id: records[0].id,
          name: 'logs.txt',
          bucket: SUPPORT_ATTACHMENT_BUCKET,
          role: 'user',
          authorization: `Bearer ${mockSession.accessToken}`,
          body: 'diagnostic contents',
        },
      ]);
      await user.click(screen.getByRole('button', { name: 'Create ticket' }));
      await waitFor(() =>
        expect(router.push).toHaveBeenCalledWith(
          `/support/tickets/${ticketID}`,
        ),
      );
      expect(
        requests.find((item) => item.operation === 'ticket'),
      ).toMatchObject({
        role: 'user',
        variables: {
          input: {
            attachmentDraftID: draftID,
            organizationID,
            description: '**Diagnostic details**',
          },
        },
      });
      expect(draft).toBeNull();
      expect(submittedTicket).toEqual({
        id: ticketID,
        attachmentDraftID: draftID,
      });
      expect(records[0]).toMatchObject({ draftID: null, ticketID });
      await screen.findByRole('link', { name: 'Open the created ticket' });
      expect(screen.getByLabelText('Attach files')).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Discard draft attachments' }),
      ).toBeDisabled();
    },
  );

  it('requires an organization and valid file before creating any draft or reservation', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await screen.findByRole('heading', { name: 'Create a support ticket' });
    expect(screen.getByLabelText('Attach files')).toBeDisabled();
    await selectOrganization(user);
    await user.upload(screen.getByLabelText('Attach files'), [
      new File([], 'empty.txt'),
      new File([new Uint8Array(5_000_001)], 'large.txt'),
    ]);
    expect(
      screen.getByText('Empty files cannot be attached.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Files must be 5 MB or smaller.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry failed uploads' }),
    ).not.toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('blocks submission until failed reservations are discarded, while keeping successful uploads', async () => {
    failUpload.add('failed.txt');
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user, ['kept.txt', 'failed.txt']);
    await screen.findByText(/Upload could not be confirmed/);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove failed.txt' }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByRole('button', { name: 'Create ticket' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove failed.txt' }));
    await uploaded();
    expect(records.find((item) => item.name === 'failed.txt')?.discarded).toBe(
      true,
    );
    expect(
      screen.getByRole('button', { name: 'Remove attachment kept.txt' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(storageRequests).toHaveLength(2);
  });

  it('discards a failed reservation before retrying with a fresh upload ID', async () => {
    failUpload.add('logs.txt');
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await screen.findByText(/Upload could not be confirmed/);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Retry failed uploads' }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole('button', { name: 'Retry failed uploads' }),
    );
    await uploaded();
    expect(storageRequests).toHaveLength(2);
    expect(storageRequests[0].id).not.toBe(storageRequests[1].id);
    expect(records[0].discarded).toBe(true);
    expect(
      requests
        .filter((item) => ['reserve', 'discard'].includes(item.operation))
        .map((item) => item.operation),
    ).toEqual(['reserve', 'discard', 'reserve']);
  });

  it('recognizes a completed upload after a lost response instead of uploading it again', async () => {
    loseUploadResponse = true;
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await screen.findByText(/Upload could not be confirmed/);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Retry failed uploads' }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole('button', { name: 'Retry failed uploads' }),
    );
    await uploaded();
    expect(storageRequests).toHaveLength(1);
    expect(records).toHaveLength(1);
    expect(records[0].discarded).toBe(false);
  });

  it('exposes an unfinished reservation after its response was lost so it can be discarded', async () => {
    loseReservationResponse = true;
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    const discard = await screen.findByRole('button', {
      name: /Discard unfinished upload/,
    });
    await waitFor(() => expect(discard).toBeEnabled());
    expect(storageRequests).toEqual([]);
    await user.click(discard);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Retry failed uploads' }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole('button', { name: 'Retry failed uploads' }),
    );
    await uploaded();
    expect(records[0].discarded).toBe(true);
    expect(records[1].completed).toBe(true);
  });

  it('recovers the created ticket after a lost submission response without inserting again', async () => {
    loseSubmissionResponse = true;
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await uploaded();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/support/tickets/${ticketID}`),
    );
    expect(requests.filter((item) => item.operation === 'ticket')).toHaveLength(
      1,
    );
  });

  it('keeps the draft and its uploads retryable when ticket creation is rejected', async () => {
    failTicketInsert = true;
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await uploaded();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await screen.findByText(/Draft cannot be submitted/);
    expect(draft?.id).toBe(draftID);
    expect(submittedTicket).toBeNull();
    expect(records[0]).toMatchObject({
      draftID,
      ticketID: null,
      completed: true,
    });
    failTicketInsert = false;
    await uploaded();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/support/tickets/${ticketID}`),
    );
    expect(requests.filter((item) => item.operation === 'draft')).toHaveLength(
      1,
    );
    expect(storageRequests).toHaveLength(1);
    expect(draft).toBeNull();
  });

  it('retains the same submission token if submission and its recovery lookup both fail', async () => {
    loseSubmissionResponse = true;
    failSubmissionRecovery = true;
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await uploaded();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await screen.findByText(/Ticket submission could not be confirmed/);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Uploads fail',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('link', { name: 'Open the created ticket' });
    await uploaded();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/support/tickets/${ticketID}`),
    );
    expect(requests.filter((item) => item.operation === 'draft')).toHaveLength(
      1,
    );
    expect(requests.filter((item) => item.operation === 'ticket')).toHaveLength(
      1,
    );
  });

  it('does not replace a deleted draft when the submitted ticket is no longer visible', async () => {
    loseSubmissionResponse = true;
    denyTicketReads = true;
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await uploaded();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await screen.findByText(/Ticket submission could not be confirmed/);
    expect(draft).toBeNull();
    expect(submittedTicket).toEqual({
      id: ticketID,
      attachmentDraftID: draftID,
    });
    expect(
      screen.getByRole('combobox', { name: 'Organization' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Create ticket' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Discard draft attachments' }),
    ).toBeDisabled();
    expect(requests.filter((item) => item.operation === 'cancel')).toHaveLength(
      0,
    );
    expect(requests.filter((item) => item.operation === 'draft')).toHaveLength(
      1,
    );
    denyTicketReads = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('link', { name: 'Open the created ticket' });
    await uploaded();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/support/tickets/${ticketID}`),
    );
    expect(requests.filter((item) => item.operation === 'ticket')).toHaveLength(
      1,
    );
  });

  it('preserves the token and prevents clearing while a submission may still be in flight', async () => {
    deferSubmission = true;
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await uploaded();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await screen.findByText(/The previous submission could not be confirmed/);
    expect(
      screen.getByRole('button', { name: 'Discard draft attachments' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Organization' }),
    ).toBeDisabled();
    expect(screen.getByText(draftID)).toBeInTheDocument();
    expect(draft?.id).toBe(draftID);
    publishDraft();
    await user.click(screen.getByRole('button', { name: 'Check submission' }));
    await screen.findByRole('link', { name: 'Open the created ticket' });
    await uploaded();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/support/tickets/${ticketID}`),
    );
    expect(requests.filter((item) => item.operation === 'draft')).toHaveLength(
      1,
    );
    expect(requests.filter((item) => item.operation === 'ticket')).toHaveLength(
      1,
    );
  });

  it('discards retained reservations before allowing an organization change and keeps ticket text', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await uploaded();
    expect(
      screen.getByRole('combobox', { name: 'Organization' }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: 'Discard draft attachments' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Organization' }),
      ).toBeEnabled(),
    );
    expect(requests.find((item) => item.operation === 'discard')).toMatchObject(
      {
        role: 'user',
        variables: { id: records[0].id, at: expect.any(String) },
      },
    );
    expect(records[0].discarded).toBe(true);
    expect(draft?.id).toBe(draftID);
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
      '**Diagnostic details**',
    );
    await selectOrganization(user, 'Other org');
    expect(
      screen.getByRole('combobox', { name: 'Organization' }),
    ).toHaveTextContent('Other org');
  });

  it('does not expire immutable drafts based on their creation time', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await uploaded();
    draft!.createdAt = '2020-01-01T00:00:00Z';
    await queryClient.invalidateQueries({ queryKey: ['support'] });
    await screen.findByText(/Draft created.*2020/);
    expect(screen.getByLabelText('Attach files')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Create ticket' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Remove attachment logs.txt' }),
    ).toBeEnabled();
  });

  it('hides stale file metadata and blocks submission when draft access is revoked', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await uploaded();
    denyDraftReads = true;
    await queryClient.invalidateQueries({ queryKey: ['support'] });
    await screen.findByText(/Unable to load draft attachments/);
    expect(
      screen.queryByRole('button', { name: 'Remove attachment logs.txt' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create ticket' }),
    ).toBeDisabled();
    expect(screen.getByLabelText('Attach files')).toBeDisabled();
  });

  it('reads all 100-row pages and blocks submission for an unfinished reservation beyond the first page', async () => {
    const { result } = renderHook(
      () => useSupportAttachmentDraft(organizationID),
      { wrapper: Providers },
    );
    act(() => result.current.addFiles([new File(['logs'], 'logs.txt')]));
    await act(async () => {
      await result.current.action.mutateAsync({ type: 'upload' });
    });
    await waitFor(() => expect(result.current.blocked).toBe(false));
    for (let index = 0; index < 100; index += 1) {
      const entry = reserve(`extra-${index}.txt`);
      entry.completed = index < 99;
    }
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['support'] });
    });
    await waitFor(() => expect(result.current.unfinished).toHaveLength(1));
    expect(result.current.blocked).toBe(true);
    await expect(result.current.prepareSubmission()).rejects.toThrow(
      'Upload or remove unfinished attachments',
    );
    expect(
      requests
        .filter((item) => item.operation === 'read')
        .map((item) => item.variables.offset),
    ).toContain(100);
    await act(async () => {
      await result.current.action.mutateAsync({
        type: 'discard',
        id: records[100].id,
      });
    });
    await waitFor(() => expect(result.current.blocked).toBe(false));
    expect(result.current.query.data?.draft?.attachments).toHaveLength(100);
    await expect(result.current.prepareSubmission()).resolves.toEqual({
      draftID,
    });
  });
});
