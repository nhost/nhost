import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import TicketAttachments from '@/features/support/components/TicketAttachments';
import { SUPPORT_ATTACHMENT_BUCKET } from '@/features/support/utils/attachments';
import type { DashboardSupportAttachmentsQuery } from '@/generated/graphql';
import { useNhostClient } from '@/providers/nhost';
import { mockMultipartFormData } from '@/tests/mock-multipart-form-data';
import { mockMatchMediaValue, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

type Attachment = NonNullable<
  DashboardSupportAttachmentsQuery['supportTicket']
>['attachments'][number];
const ticketId = '7d442aba-6e61-4854-b354-0d5ec8d198d8';
const originalToken = mockSession.accessToken;
const originalClaims = structuredClone(mockSession.decodedToken);
const createObjectURL = vi.fn().mockReturnValue('blob:attachment-download');
const revokeObjectURL = vi.fn();
let downloads: { href: string; name: string }[];
let files: Attachment[];
let reservationCount: number;
let failures: Set<string>;
let queries: { role: string | null; variables: Record<string, unknown> }[];
let reservations: {
  id: string;
  role: string | null;
  variables: Record<string, unknown>;
}[];
let uploads: {
  id: string;
  name: string;
  body: string;
  bucket: FormDataEntryValue | null;
  role: string | null;
  authorization: string | null;
}[];
let reads: {
  role: string | null;
  authorization: string | null;
  id: string | readonly string[] | undefined;
}[];

function attachment(id: string, name = 'diagnostic.html'): Attachment {
  return {
    id,
    uploaderName: 'Customer Alice',
    createdAt: '2026-01-01T12:00:00Z',
    file: { id, name, size: 30, mimeType: 'text/html' },
  };
}
function setRole(role: 'user' | 'support_agent') {
  const claims = {
    'x-hasura-user-id': mockSession.user!.id,
    'x-hasura-default-role': 'user',
    'x-hasura-allowed-roles':
      role === 'user' ? ['user'] : ['user', 'support_agent'],
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
  nhostGraphQLLink.query(
    'dashboardSupportAttachments',
    ({ request, variables }) => {
      queries.push({ role: request.headers.get('x-hasura-role'), variables });
      return HttpResponse.json({
        data: { supportTicket: { attachments: files } },
      });
    },
  ),
  nhostGraphQLLink.mutation(
    'dashboardReserveSupportAttachment',
    ({ request, variables }) => {
      reservationCount += 1;
      const id = `00000000-0000-4000-8000-${String(reservationCount).padStart(12, '0')}`;
      reservations.push({
        id,
        role: request.headers.get('x-hasura-role'),
        variables,
      });
      return HttpResponse.json({
        data: { insertSupportAttachmentUpload: { id } },
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
          { error: { message: 'Missing upload data' } },
          { status: 400 },
        );
      }
      const { id } = JSON.parse(
        typeof metadata === 'string' ? metadata : await metadata.text(),
      ) as { id: string };
      uploads.push({
        id,
        name: file.name,
        body: await file.text(),
        bucket: data.get('bucket-id'),
        role: request.headers.get('x-hasura-role'),
        authorization: request.headers.get('authorization'),
      });
      if (failures.delete(file.name)) {
        return HttpResponse.json(
          { error: { message: 'Upload rejected' } },
          { status: 403 },
        );
      }
      files.push(attachment(id, file.name));
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
  http.get(
    'https://local.storage.local.nhost.run/v1/files/:id',
    ({ request, params }) => {
      reads.push({
        id: params.id,
        role: request.headers.get('x-hasura-role'),
        authorization: request.headers.get('authorization'),
      });
      return new HttpResponse('<script>untrusted attachment</script>', {
        headers: { 'content-type': 'text/html' },
      });
    },
  ),
);

mockMultipartFormData();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    function captureDownload(this: HTMLAnchorElement) {
      downloads.push({ href: this.href, name: this.download });
    },
  );
  toast.remove();
  queryClient.clear();
  setRole('user');
  files = [attachment('existing-file')];
  downloads = [];
  reservations = [];
  uploads = [];
  reads = [];
  queries = [];
  failures = new Set();
  reservationCount = 0;
});
afterEach(() => {
  server.resetHandlers();
  toast.remove();
  queryClient.clear();
  mockSession.accessToken = originalToken;
  mockSession.decodedToken = structuredClone(originalClaims);
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

async function chooseFiles(user: TestUserEvent, selected: File[]) {
  await waitFor(() =>
    expect(screen.getByLabelText('Attach files')).toBeEnabled(),
  );
  await user.upload(screen.getByLabelText('Attach files'), selected);
}
function renderAttachments(closed = false) {
  return render(
    <TicketAttachments ticketId={ticketId} closed={closed} disabled={false} />,
  );
}

describe('ticket attachments', () => {
  it.each(['user', 'support_agent'] as const)(
    'reserves and uploads files with the native %s role',
    async (role) => {
      setRole(role);
      const user = new TestUserEvent();
      renderAttachments();
      await chooseFiles(user, [
        new File(['diagnostic contents'], 'diagnostic.txt', {
          type: 'text/plain',
        }),
      ]);
      await user.click(screen.getByRole('button', { name: 'Upload files' }));
      await screen.findByText('Uploaded');
      expect(reservations).toEqual([
        { id: expect.any(String), role, variables: { ticketId } },
      ]);
      expect(uploads).toEqual([
        {
          id: reservations[0].id,
          name: 'diagnostic.txt',
          body: 'diagnostic contents',
          bucket: SUPPORT_ATTACHMENT_BUCKET,
          role,
          authorization: `Bearer ${mockSession.accessToken}`,
        },
      ]);
      expect(queries[0]).toEqual({ role, variables: { ticketId, offset: 0 } });
      await screen.findByRole('button', { name: 'Download diagnostic.txt' });
    },
  );

  it('rejects empty and oversized files before reserving upload IDs', async () => {
    const user = new TestUserEvent();
    renderAttachments();
    await chooseFiles(user, [
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
      screen.queryByRole('button', { name: 'Upload files' }),
    ).not.toBeInTheDocument();
    expect(reservations).toEqual([]);
    expect(uploads).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Remove empty.txt' }));
    expect(screen.queryByText('empty.txt')).not.toBeInTheDocument();
  });

  it('keeps successful files and reserves a fresh ID when retrying a failed file', async () => {
    failures.add('second.txt');
    const user = new TestUserEvent();
    renderAttachments();
    await chooseFiles(user, [
      new File(['first'], 'first.txt'),
      new File(['second'], 'second.txt'),
    ]);
    await user.click(screen.getByRole('button', { name: 'Upload files' }));
    await screen.findByText(/Upload could not be confirmed/);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Upload files' }),
      ).toBeEnabled(),
    );
    await screen.findByRole('button', { name: 'Download first.txt' });
    expect(screen.queryByText('Files uploaded')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Upload files' }));
    await waitFor(() =>
      expect(screen.getAllByText('Uploaded')).toHaveLength(2),
    );
    expect(uploads.map(({ name }) => name)).toEqual([
      'first.txt',
      'second.txt',
      'second.txt',
    ]);
    expect(new Set(uploads.map(({ id }) => id)).size).toBe(3);
    expect(reservations).toHaveLength(3);
  });

  it('does not send bytes if the reservation is rejected', async () => {
    server.use(
      nhostGraphQLLink.mutation('dashboardReserveSupportAttachment', () =>
        HttpResponse.json({ errors: [{ message: 'Ticket is closed' }] }),
      ),
    );
    const user = new TestUserEvent();
    renderAttachments();
    await chooseFiles(user, [new File(['logs'], 'logs.txt')]);
    await user.click(screen.getByRole('button', { name: 'Upload files' }));
    await screen.findByText(/Upload could not be confirmed/);
    expect(uploads).toEqual([]);
  });

  it.each(['user', 'support_agent'] as const)(
    'downloads closed-ticket files safely with the native %s role',
    async (role) => {
      setRole(role);
      renderAttachments(true);
      await new TestUserEvent().click(
        await screen.findByRole('button', { name: 'Download diagnostic.html' }),
      );
      await waitFor(() =>
        expect(downloads).toEqual([
          { href: 'blob:attachment-download', name: 'diagnostic.html' },
        ]),
      );
      expect(reads).toEqual([
        {
          id: 'existing-file',
          role,
          authorization: `Bearer ${mockSession.accessToken}`,
        },
      ]);
      expect(createObjectURL.mock.calls[0][0].type).toBe(
        'application/octet-stream',
      );
      expect(
        document.querySelector('iframe, embed, article script'),
      ).toBeNull();
      expect(screen.queryByLabelText('Attach files')).not.toBeInTheDocument();
      await waitFor(
        () =>
          expect(revokeObjectURL).toHaveBeenCalledWith(
            'blob:attachment-download',
          ),
        { timeout: 2500 },
      );
    },
  );

  it('does not create a blob URL when Storage denies a download', async () => {
    server.use(
      http.get('https://local.storage.local.nhost.run/v1/files/:id', () =>
        HttpResponse.json(
          { error: { message: 'Access denied' } },
          { status: 403 },
        ),
      ),
    );
    renderAttachments();
    await new TestUserEvent().click(
      await screen.findByRole('button', { name: 'Download diagnostic.html' }),
    );
    await screen.findByText('Access denied');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(downloads).toEqual([]);
  });

  it('paginates the server-limited attachment view without losing the boundary', async () => {
    server.use(
      nhostGraphQLLink.query('dashboardSupportAttachments', ({ variables }) => {
        const offset = Number(variables.offset);
        queries.push({ role: 'user', variables });
        return HttpResponse.json({
          data: {
            supportTicket: {
              attachments: Array.from(
                { length: offset === 0 ? 100 : 1 },
                (_, index) =>
                  attachment(
                    `file-${offset + index}`,
                    `log-${offset + index}.txt`,
                  ),
              ),
            },
          },
        });
      }),
    );
    renderAttachments();
    await screen.findByText('log-99.txt');
    await new TestUserEvent().click(
      screen.getByRole('button', { name: 'Load more attachments' }),
    );
    await screen.findByText('log-100.txt');
    expect(screen.getAllByText('log-99.txt')).toHaveLength(1);
    expect(queries.map(({ variables }) => variables.offset)).toEqual([0, 100]);
    expect(
      screen.queryByRole('button', { name: 'Load more attachments' }),
    ).not.toBeInTheDocument();
  });

  it('hides stale attachment metadata and disables uploads after access fails', async () => {
    renderAttachments();
    await screen.findByRole('button', { name: 'Download diagnostic.html' });
    server.use(
      nhostGraphQLLink.query('dashboardSupportAttachments', () =>
        HttpResponse.json({ data: { supportTicket: null } }),
      ),
    );
    await queryClient.invalidateQueries({ queryKey: ['support'] });
    await screen.findByText(/Unable to load attachments/);
    expect(screen.queryByText('diagnostic.html')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Attach files')).toBeDisabled();
  });

  it('discards a download if the signed-in account changes while bytes are in flight', async () => {
    let release: () => void = () => {};
    let started = false;
    const response = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(
        'https://local.storage.local.nhost.run/v1/files/:id',
        async () => {
          started = true;
          await response;
          return new HttpResponse('private content');
        },
      ),
    );
    function SwitchAccount() {
      const nhost = useNhostClient();
      return (
        <button
          type="button"
          onClick={() => {
            nhost.sessionStorage.set({
              ...mockSession,
              user: { ...mockSession.user!, id: 'different-user' },
            });
          }}
        >
          Switch account
        </button>
      );
    }
    render(
      <>
        <SwitchAccount />
        <TicketAttachments
          ticketId={ticketId}
          closed={false}
          disabled={false}
        />
      </>,
    );
    const user = new TestUserEvent();
    await user.click(
      await screen.findByRole('button', { name: 'Download diagnostic.html' }),
    );
    await waitFor(() => expect(started).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Switch account' }));
    release();
    await screen.findByText('Your session changed. Please sign in again.');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(downloads).toEqual([]);
  });
});
