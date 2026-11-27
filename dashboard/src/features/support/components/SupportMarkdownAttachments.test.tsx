import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import SupportMarkdown from '@/features/support/components/SupportMarkdown';
import { mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';

const id = '41261576-2d59-4c12-bc6e-e573bdba3af1';
const ticketId = '7d442aba-6e61-4854-b354-0d5ec8d198d8';
const originalToken = mockSession.accessToken;
const originalClaims = structuredClone(mockSession.decodedToken);
const createObjectURL = vi.fn().mockReturnValue('blob:private-image');
const revokeObjectURL = vi.fn();
let mimeType: string;
let contentType: string;
let thumbnailType: string;
let accessible: boolean;
let listReads: {
  role: string | null;
  variables: Record<string, unknown>;
}[];
let inlineReads: number;
let storageReads: {
  role: string | null;
  authorization: string | null;
  cache: RequestCache;
  params: Record<string, string>;
}[];
const server = setupServer(
  http.post('https://local.auth.local.nhost.run/v1/token', () =>
    HttpResponse.json({ ...mockSession }),
  ),
  nhostGraphQLLink.query(
    'dashboardSupportAttachments',
    ({ request, variables }) => {
      listReads.push({
        role: request.headers.get('x-hasura-role'),
        variables,
      });
      return HttpResponse.json({
        data: {
          supportTicket: {
            attachments: accessible
              ? [
                  {
                    id,
                    uploaderName: 'Customer Alice',
                    createdAt: '2026-01-01T12:00:00Z',
                    file: { id, name: 'diagnostic', mimeType, size: 30 },
                  },
                ]
              : [],
          },
        },
      });
    },
  ),
  nhostGraphQLLink.query('dashboardSupportInlineAttachment', () => {
    inlineReads += 1;
    return HttpResponse.json({ data: { supportAttachmentUploads: [] } });
  }),
  http.get(
    'https://local.storage.local.nhost.run/v1/files/:id',
    ({ request }) => {
      const params = Object.fromEntries(new URL(request.url).searchParams);
      storageReads.push({
        role: request.headers.get('x-hasura-role'),
        authorization: request.headers.get('authorization'),
        cache: request.cache,
        params,
      });
      return new HttpResponse(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        {
          headers: {
            'content-type': params.f === 'webp' ? thumbnailType : contentType,
          },
        },
      );
    },
  ),
);
const thumbnail = { w: '128', h: '128', q: '75', f: 'webp' };
async function loadedImage(container: HTMLElement = document.body) {
  await waitFor(() =>
    expect(
      within(container).getByRole('img', { name: 'diagnostic' }),
    ).toHaveAttribute('src', 'blob:private-image'),
  );
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
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient.clear();
  authorize(false);
  accessible = true;
  mimeType = 'image/png';
  contentType = 'image/png';
  thumbnailType = 'image/webp';
  listReads = [];
  inlineReads = 0;
  storageReads = [];
  // Without an observer, thumbnails count as visible and load immediately.
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  toast.remove();
  mockSession.accessToken = originalToken;
  mockSession.decodedToken = structuredClone(originalClaims);
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

describe('attachments in rendered messages', () => {
  it.each([false, true])(
    "shows ticket images through authenticated reads with the viewer's role (agent=%s)",
    async (agent) => {
      authorize(agent);
      const user = new TestUserEvent();
      const { unmount } = render(
        <SupportMarkdown
          ticketId={ticketId}
        >{`![Screenshot](attachment:${id})`}</SupportMarkdown>,
      );
      await loadedImage();
      const role = agent ? 'support' : 'user';
      expect(listReads).toEqual([{ role, variables: { ticketId, offset: 0 } }]);
      expect(inlineReads).toBe(0);
      expect(storageReads).toEqual([
        {
          role,
          authorization: `Bearer ${mockSession.accessToken}`,
          cache: 'no-store',
          params: thumbnail,
        },
      ]);

      await user.click(
        screen.getByRole('button', { name: 'View diagnostic full size' }),
      );
      await loadedImage(
        await screen.findByRole('dialog', { name: 'diagnostic' }),
      );
      expect(storageReads[1]).toEqual({
        role,
        authorization: `Bearer ${mockSession.accessToken}`,
        cache: 'no-store',
        params: {},
      });
      expect(createObjectURL.mock.calls.at(-1)?.[0].type).toBe('image/png');
      unmount();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:private-image');
    },
  );

  it('checks many references with one attachment list request', async () => {
    accessible = false;
    const references = Array.from(
      { length: 25 },
      (_, index) =>
        `![Image ${index}](attachment:41261576-2d59-4c12-bc6e-${String(index).padStart(12, '0')})`,
    ).join('\n\n');
    render(<SupportMarkdown ticketId={ticketId}>{references}</SupportMarkdown>);
    expect(
      await screen.findByRole('img', {
        name: 'Attachment unavailable: Image 24',
      }),
    ).toBeInTheDocument();
    expect(listReads).toHaveLength(1);
    expect(inlineReads).toBe(0);
    expect(storageReads).toEqual([]);
  });

  it('downloads a file attachment with authentication and an inert MIME type', async () => {
    mimeType = 'text/plain';
    contentType = 'text/plain';
    const save = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    render(
      <SupportMarkdown
        ticketId={ticketId}
      >{`[Logs](attachment:${id})`}</SupportMarkdown>,
    );
    await new TestUserEvent().click(
      await screen.findByRole('button', { name: 'Download diagnostic' }),
    );
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(createObjectURL.mock.calls[0][0].type).toBe(
      'application/octet-stream',
    );
    expect(storageReads).toEqual([
      expect.objectContaining({ role: 'user', cache: 'no-store', params: {} }),
    ]);
  });

  it.each([
    [
      'an image',
      `![Private](attachment:${id})`,
      () =>
        screen.findByRole('img', { name: 'Attachment unavailable: Private' }),
    ],
    [
      'a file',
      `[Private logs](attachment:${id})`,
      () => screen.findByText('Attachment unavailable: Private logs'),
    ],
  ])(
    'does not fetch %s outside the current ticket',
    async (_kind, markdown, findUnavailable) => {
      accessible = false;
      render(<SupportMarkdown ticketId={ticketId}>{markdown}</SupportMarkdown>);
      expect(await findUnavailable()).toBeInTheDocument();
      expect(storageReads).toEqual([]);
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(document.querySelector('img')).toBeNull();
    },
  );

  it.each(['image/svg+xml', 'text/html'])(
    'keeps %s attachments downloadable instead of embedding them',
    async (type) => {
      mimeType = type;
      contentType = type;
      render(
        <SupportMarkdown
          ticketId={ticketId}
        >{`![Untrusted](attachment:${id})`}</SupportMarkdown>,
      );
      await screen.findByRole('button', { name: 'Download diagnostic' });
      expect(document.querySelector('img')).toBeNull();
      expect(storageReads).toEqual([]);
      expect(createObjectURL).not.toHaveBeenCalled();
    },
  );

  it('does not embed bytes with a mismatched content type', async () => {
    thumbnailType = 'text/html';
    contentType = 'text/html';
    const user = new TestUserEvent();
    render(
      <SupportMarkdown
        ticketId={ticketId}
      >{`![Not a PNG](attachment:${id})`}</SupportMarkdown>,
    );
    await waitFor(() => expect(storageReads).toHaveLength(1));
    await user.click(
      await screen.findByRole('button', { name: 'View diagnostic full size' }),
    );
    expect(
      await within(
        await screen.findByRole('dialog', { name: 'diagnostic' }),
      ).findByText("Couldn't load this image."),
    ).toBeInTheDocument();
    expect(storageReads).toHaveLength(2);
    expect(document.querySelector('img')).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('hides a loaded image and revokes its URL when access is lost', async () => {
    render(
      <SupportMarkdown
        ticketId={ticketId}
      >{`![Screenshot](attachment:${id})`}</SupportMarkdown>,
    );
    await loadedImage();
    accessible = false;
    await queryClient.invalidateQueries({ queryKey: ['support'] });
    await screen.findByRole('img', {
      name: 'Attachment unavailable: Screenshot',
    });
    expect(document.querySelector('img')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:private-image');
  });
});
