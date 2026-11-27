import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import NewTicket from '@/features/support/components/NewTicket';
import { useSupportAttachmentDraft } from '@/features/support/hooks/useSupportAttachmentDraft';
import { SUPPORT_ATTACHMENT_BUCKET } from '@/features/support/utils/attachments';
import type {
  DashboardSupportAttachmentDraftQuery,
  SupportTickets_Insert_Input,
} from '@/generated/graphql';
import { mockMultipartFormData } from '@/tests/mock-multipart-form-data';
import { mockMatchMediaValue, mockRouter, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  editorValue,
  expectInputValue,
  selectEditorText,
} from '@/tests/supportEditor';
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
  within,
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
const originalURL = URL;
const originalIntersectionObserver = IntersectionObserver;
const createObjectURL = vi.fn().mockReturnValue('blob:draft-thumbnail');
const revokeObjectURL = vi.fn();
let previewRequests: { role: string | null; params: Record<string, string> }[];
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
    'x-hasura-allowed-roles': agent ? ['user', 'support'] : ['user'],
  };
  mockSession.decodedToken = {
    ...originalClaims,
    'https://hasura.io/jwt/claims': claims,
  };
  mockSession.accessToken = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: mockSession.user!.id, exp: Math.floor(Date.now() / 1000) + 3600, 'https://hasura.io/jwt/claims': claims }))}.test-signature`;
}
const server = setupServer(
  nhostGraphQLLink.query('dashboardSupportInlineAttachment', ({ variables }) =>
    HttpResponse.json({
      data: {
        supportAttachmentUploads: records
          .filter(
            (item) =>
              item.id === variables.id &&
              item.completed &&
              !item.discarded &&
              item.draftID === draftID,
          )
          .map((item) => ({
            file: {
              id: item.id,
              name: item.name,
              mimeType: item.mimeType,
              size: 30,
            },
          })),
      },
    }),
  ),
  http.get(
    'https://local.storage.local.nhost.run/v1/files/:id',
    ({ request }) => {
      previewRequests.push({
        role: request.headers.get('x-hasura-role'),
        params: Object.fromEntries(new URL(request.url).searchParams),
      });
      return new HttpResponse(
        new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
        { headers: { 'content-type': 'image/webp' } },
      );
    },
  ),
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
            slug: 'acme',
            plan: {
              name: 'Team',
              supportAllowedSeverities: ['low', 'normal', 'high', 'urgent'],
            },
            apps: [],
          },
          {
            id: otherOrganizationID,
            name: 'Other org',
            slug: 'other-org',
            plan: { name: 'Starter', supportAllowedSeverities: ['low'] },
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
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(
        private callback: (
          entries: Pick<
            IntersectionObserverEntry,
            'target' | 'isIntersecting' | 'intersectionRatio'
          >[],
        ) => void,
      ) {}
      observe(target: Element) {
        this.callback([{ target, isIntersecting: true, intersectionRatio: 1 }]);
      }
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
    },
  );
  previewRequests = [];
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
  vi.stubGlobal('URL', originalURL);
  vi.stubGlobal('IntersectionObserver', originalIntersectionObserver);
});
afterAll(() => server.close());

async function selectOrganization(user: TestUserEvent, name = 'Acme') {
  await user.click(screen.getByRole('combobox', { name: 'Organization' }));
  await user.click(await screen.findByRole('option', { name }));
}
async function fillForm(user: TestUserEvent) {
  await screen.findByRole('heading', { name: 'New ticket' });
  await selectOrganization(user);
  await user.type(
    screen.getByRole('textbox', { name: 'Title' }),
    'Uploads fail',
  );
  await user.click(screen.getByRole('textbox', { name: 'Description' }));
  await user.paste('**Diagnostic details**');
  await user.click(screen.getByRole('button', { name: 'Storage' }));
}
async function uploadFiles(user: TestUserEvent, names = ['logs.txt']) {
  await user.upload(
    screen.getByLabelText('Choose attachments'),
    names.map(
      (name) => new File(['diagnostic contents'], name, { type: 'text/plain' }),
    ),
  );
}
async function uploaded() {
  await waitFor(
    () =>
      expect(
        screen.getByRole('button', { name: 'Create ticket' }),
      ).toBeEnabled(),
    { timeout: 5_000 },
  );
}

describe('new ticket attachment drafts', () => {
  it('offers a keyboard-accessible picker only after selecting an organization', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await screen.findByRole('heading', { name: 'New ticket' });
    const zone = screen.getByRole('button', { name: 'Attach files' });
    expect(zone).toBeDisabled();
    expect(screen.getByText('Drag files here')).toBeVisible();
    await selectOrganization(user);
    expect(zone).toBeEnabled();
    const picker = vi.spyOn(
      screen.getByLabelText('Choose attachments'),
      'click',
    );
    zone.focus();
    await user.keyboard('{Enter}');
    expect(picker).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(picker).toHaveBeenCalledTimes(2);
  });

  it('prevents file navigation when unavailable or when a drop misses the attachments', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await screen.findByRole('heading', { name: 'New ticket' });
    const box = screen.getByRole('group', { name: 'Description editor' });
    const transfer = {
      types: ['Files'],
      files: [new File(['image'], 'photo.png', { type: 'image/png' })],
    };
    expect(fireEvent.dragOver(box, { dataTransfer: transfer })).toBe(false);
    expect(within(box).getByRole('status')).toHaveTextContent(
      'Pick an organization first',
    );
    expect(box).toHaveClass('border-destructive');
    expect(fireEvent.drop(box, { dataTransfer: transfer })).toBe(false);
    expect(within(box).queryByRole('status')).not.toBeInTheDocument();
    await selectOrganization(user);
    expect(
      fireEvent.drop(screen.getByRole('textbox', { name: 'Title' }), {
        dataTransfer: transfer,
      }),
    ).toBe(false);
    expect(storageRequests).toHaveLength(0);
    expect(requests).toHaveLength(0);
  });

  it('shows the drag state and accepts additional files dropped on the description', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    const zone = screen.getByRole('group', { name: 'Description editor' });
    const transfer = {
      types: ['Files'],
      files: [new File(['logs'], 'first.txt')],
    };
    expect(fireEvent.dragOver(zone, { dataTransfer: transfer })).toBe(false);
    expect(zone).toHaveTextContent('Drop to attach');
    expect(zone).toHaveClass('ring-2', 'border-primary');
    fireEvent.drop(zone, { dataTransfer: transfer });
    await uploaded();
    await screen.findByRole('button', { name: 'Remove first.txt' });
    expect(
      fireEvent.drop(zone, {
        dataTransfer: {
          types: ['Files'],
          files: [new File(['more logs'], 'second.txt')],
        },
      }),
    ).toBe(false);
    await uploaded();
    await screen.findByRole('button', { name: 'Remove second.txt' });
    expect(storageRequests.map((request) => request.name)).toEqual([
      'first.txt',
      'second.txt',
    ]);
    expect(
      requests.filter((request) => request.operation === 'draft'),
    ).toHaveLength(1);
  });

  it('uploads multiple files from the description and inserts confirmed links', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    fireEvent.drop(screen.getByRole('group', { name: 'Description editor' }), {
      dataTransfer: {
        types: ['Files'],
        files: [
          new File(['first'], 'first.txt'),
          new File(['second'], 'second.txt'),
        ],
      },
    });
    await screen.findByRole(
      'button',
      { name: 'Remove second.txt' },
      { timeout: 10_000 },
    );
    await uploaded();
    await waitFor(() =>
      expectInputValue(
        screen.getByRole('textbox', { name: 'Description' }),
        `**Diagnostic details**\n[first.txt](attachment:${records[0].id})\n[second.txt](attachment:${records[1].id})\n`,
      ),
    );
    expect(
      within(
        screen.getByRole('region', { name: 'Draft attachments' }),
      ).queryByRole('list'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download second.txt' }),
    ).toBeEnabled();
  });
  it('discards the upload when its card is removed', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await uploaded();
    await user.click(
      await screen.findByRole('button', { name: 'Remove logs.txt' }),
    );
    await waitFor(() => {
      expect(records[0].discarded).toBe(true);
      expect(
        screen.queryByRole('button', { name: 'Remove logs.txt' }),
      ).not.toBeInTheDocument();
      expectInputValue(
        screen.getByRole('textbox', { name: 'Description' }),
        '**Diagnostic details**\n\n',
      );
    });
  });
  it('lists uploads deleted from the description and blocks submission until they are inserted or removed', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await uploaded();
    const description = screen.getByRole('textbox', { name: 'Description' });
    const token = `[logs.txt](attachment:${records[0].id})`;
    async function deleteToken() {
      selectEditorText(
        description,
        editorValue(description).indexOf(token) + token.length,
      );
      await user.keyboard('{Backspace}');
      expect(editorValue(description)).not.toContain(token);
    }
    const attachments = screen.getByRole('region', {
      name: 'Draft attachments',
    });

    await deleteToken();
    expect(
      await within(attachments).findByText('logs.txt'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Insert or remove attachments that are not in the description/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create ticket' }),
    ).toBeDisabled();

    await user.click(
      within(attachments).getByRole('button', {
        name: 'Insert logs.txt into description',
      }),
    );
    await waitFor(() => expect(editorValue(description)).toContain(token));
    await uploaded();
    expect(within(attachments).queryByText('logs.txt')).not.toBeInTheDocument();

    await deleteToken();
    await user.click(
      await within(attachments).findByRole('button', {
        name: 'Remove logs.txt',
      }),
    );
    await waitFor(() => expect(records[0].discarded).toBe(true));
    await uploaded();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(requests.filter((item) => item.operation === 'ticket')).toHaveLength(
      1,
    );
  });

  it('shows resized draft image thumbnails as user even for a support agent', async () => {
    authorize(true);
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await user.upload(
      screen.getByLabelText('Choose attachments'),
      new File(['image'], 'screenshot.png', { type: 'image/png' }),
    );
    expect(
      await screen.findByRole('img', { name: 'screenshot.png' }),
    ).toHaveAttribute('src', 'blob:draft-thumbnail');
    expect(previewRequests).toEqual([
      { role: 'user', params: { w: '128', h: '128', q: '75', f: 'webp' } },
    ]);
  });

  it.each(['text/plain', 'image/png'])(
    'automatically uploads and inserts a dropped %s file without sending a ticket',
    async (mimeType) => {
      const user = new TestUserEvent();
      render(<NewTicket />);
      await fillForm(user);
      fireEvent.drop(screen.getByRole('textbox', { name: 'Description' }), {
        dataTransfer: {
          types: ['Files'],
          files: [
            new File(['dropped logs'], 'dropped.txt', { type: mimeType }),
          ],
        },
      });
      await screen.findByRole(
        'button',
        { name: 'Remove dropped.txt' },
        { timeout: 10000 },
      );
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
      await waitFor(() =>
        expectInputValue(
          screen.getByRole('textbox', { name: 'Description' }),
          `**Diagnostic details**\n${mimeType.startsWith('image/') ? '!' : ''}[dropped.txt](attachment:${records[0].id})\n`,
        ),
      );
    },
  );

  it('links only confirmed draft uploads when a drop partially fails', async () => {
    failUpload.add('failed.txt');
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    fireEvent.drop(screen.getByRole('textbox', { name: 'Description' }), {
      dataTransfer: {
        types: ['Files'],
        files: [
          new File(['kept'], 'kept.txt'),
          new File(['failed'], 'failed.txt'),
        ],
      },
    });
    await screen.findByText(/Upload could not be confirmed/);
    await waitFor(() =>
      expectInputValue(
        screen.getByRole('textbox', { name: 'Description' }),
        `**Diagnostic details**\n[kept.txt](attachment:${records[0].id})\n\n`,
      ),
    );
    expect(
      screen.getByRole('button', { name: 'Create ticket' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
  });

  it('inserts selected files at the description cursor and submits the raw Markdown', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    const editor = screen.getByRole('textbox', {
      name: 'Description',
    });
    selectEditorText(editor, 0);
    await user.upload(screen.getByLabelText('Choose attachments'), [
      new File(['logs'], 'logs [safe].txt', { type: 'text/plain' }),
      new File(['image'], 'screenshot.png', { type: 'image/png' }),
    ]);
    await uploaded();
    const markdown = `[logs \\[safe\\].txt](attachment:${records[0].id})\n![screenshot.png](attachment:${records[1].id})\n\n**Diagnostic details**`;
    await waitFor(() => expectInputValue(editor, markdown));
    expect(
      screen.queryByRole('button', { name: /Insert .* into description/ }),
    ).not.toBeInTheDocument();
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
            description: `**Diagnostic details**\n[logs.txt](attachment:${records[0].id})`,
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
      expect(screen.getByLabelText('Choose attachments')).toBeDisabled();
    },
  );

  it('requires an organization and valid file before creating any draft or reservation', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await screen.findByRole('heading', { name: 'New ticket' });
    expect(screen.getByLabelText('Choose attachments')).toBeDisabled();
    await selectOrganization(user);
    await user.upload(screen.getByLabelText('Choose attachments'), [
      new File([], 'empty.txt'),
      new File([new Uint8Array(5_000_001)], 'large.txt'),
    ]);
    const draftList = within(
      screen.getByRole('region', { name: 'Draft attachments' }),
    );
    expect(
      draftList.getByText('Empty files cannot be attached.'),
    ).toBeInTheDocument();
    expect(
      draftList.getByText('Files must be 5 MB or smaller.'),
    ).toBeInTheDocument();
    expect(draftList.getAllByText(/Can't be uploaded/)).toHaveLength(2);
    expect(draftList.queryByText(/Ready to upload/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry' }),
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
      screen.getByRole('button', { name: 'Remove kept.txt' }),
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
      expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
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
      expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
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
    await waitFor(() => expect(discard).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole(
      'button',
      { name: 'Remove logs.txt' },
      { timeout: 10_000 },
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
    expect(
      screen.queryByText(/The previous submission could not be confirmed/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove logs.txt' }),
    ).toBeEnabled();
    expect(screen.getByLabelText('Choose attachments')).toBeEnabled();
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

  it('allows an organization change after ticket creation is rejected', async () => {
    failTicketInsert = true;
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    await uploadFiles(user);
    await uploaded();
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    await screen.findByText(/Draft cannot be submitted/);
    await selectOrganization(user, 'Other org');
    await user.click(
      await screen.findByRole('button', { name: 'Remove files and change' }),
    );
    await waitFor(() => expect(records[0].discarded).toBe(true));
    expect(
      screen.getByRole('combobox', { name: 'Organization' }),
    ).toHaveTextContent('Other org');
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
      screen.getByRole('button', { name: 'Create ticket' }),
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
    await selectOrganization(user, 'Other org');
    await user.click(
      await screen.findByRole('button', { name: 'Remove files and change' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('combobox', { name: 'Organization' }),
    ).toHaveTextContent('Acme');

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
    await selectOrganization(user, 'Other org');
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Change organization?',
    });
    expect(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    ).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(records[0].discarded).toBe(false);
    await selectOrganization(user, 'Other org');
    await user.click(
      await screen.findByRole('button', { name: 'Remove files and change' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(requests.find((item) => item.operation === 'discard')).toMatchObject(
      {
        role: 'user',
        variables: { id: records[0].id, at: expect.any(String) },
      },
    );
    expect(records[0].discarded).toBe(true);
    expect(draft?.id).toBe(draftID);
    await waitFor(() =>
      expectInputValue(
        screen.getByRole('textbox', { name: 'Description' }),
        '**Diagnostic details**\n\n',
      ),
    );
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
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove logs.txt' }),
      ).toBeEnabled(),
    );
    expect(screen.queryByText(/Draft created/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Choose attachments')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Create ticket' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Remove logs.txt' }),
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
      screen.queryByRole('button', { name: 'Remove logs.txt' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create ticket' }),
    ).toBeDisabled();
    expect(screen.getByLabelText('Choose attachments')).toBeDisabled();
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
    const unsettled = () =>
      result.current.files.filter((file) => file.status !== 'uploaded');
    await waitFor(() => expect(unsettled()).toEqual([]));
    for (let index = 0; index < 100; index += 1) {
      const entry = reserve(`extra-${index}.txt`);
      entry.completed = index < 99;
    }
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['support'] });
    });
    await waitFor(() => expect(result.current.unfinished).toHaveLength(1));
    expect(unsettled()).toEqual([
      expect.objectContaining({ id: records[100].id, status: 'unfinished' }),
    ]);
    await expect(result.current.prepareSubmission(new Set())).rejects.toThrow(
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
    await waitFor(() => expect(unsettled()).toEqual([]));
    const attachments = result.current.query.data?.draft?.attachments ?? [];
    expect(attachments).toHaveLength(100);
    await expect(
      result.current.prepareSubmission(new Set([records[1].id])),
    ).rejects.toThrow('Insert or remove attachments that are not in the');
    await expect(
      result.current.prepareSubmission(
        new Set(attachments.map((item) => item.id)),
      ),
    ).resolves.toEqual({ draftID });
  });

  it('shows no attachment error at any point while files upload', async () => {
    const user = new TestUserEvent();
    render(<NewTicket />);
    await fillForm(user);
    const seen: string[] = [];
    const observer = new MutationObserver(() => {
      const text = document.body.textContent ?? '';
      for (const message of [
        'Upload or remove unfinished attachments',
        'Insert or remove attachments that are not in the description',
      ]) {
        if (text.includes(message) && !seen.includes(message)) {
          seen.push(message);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    await uploadFiles(user, ['one.txt', 'two.txt']);
    await uploaded();
    await waitFor(() =>
      expect(
        editorValue(screen.getByRole('textbox', { name: 'Description' })),
      ).toContain(`attachment:${records[1].id}`),
    );
    observer.disconnect();
    expect(seen).toEqual([]);
  });

  it('does not report files as unfinished while an upload is running', async () => {
    const renders: { busy: boolean; statuses: string[] }[] = [];
    const { result } = renderHook(
      () => {
        const controller = useSupportAttachmentDraft(organizationID);
        renders.push({
          busy: controller.busy,
          statuses: controller.files.map((file) => file.status),
        });
        return controller;
      },
      { wrapper: Providers },
    );
    await act(async () => {
      await result.current.action.mutateAsync({
        type: 'upload',
        files: [new File(['one'], 'one.txt'), new File(['two'], 'two.txt')],
      });
    });
    await waitFor(() =>
      expect(result.current.files.map((file) => file.status)).toEqual([
        'uploaded',
        'uploaded',
      ]),
    );
    expect(renders.some((entry) => entry.busy)).toBe(true);
    // The draft is only validated once the upload has finished.
    expect(
      renders.filter(
        ({ busy, statuses }) =>
          busy &&
          statuses.some(
            (status) => status !== 'uploaded' && status !== 'uploading',
          ),
      ),
    ).toEqual([]);
  });
});
