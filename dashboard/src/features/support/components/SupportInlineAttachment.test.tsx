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
} from '@/tests/testUtils';

const id = '41261576-2d59-4c12-bc6e-e573bdba3af1';
const ticketId = '7d442aba-6e61-4854-b354-0d5ec8d198d8';
const draftId = '87892ee8-df02-4292-9f38-9e288ef1e686';
const originalToken = mockSession.accessToken;
const originalClaims = structuredClone(mockSession.decodedToken);
const createObjectURL = vi.fn().mockReturnValue('blob:private-image');
const revokeObjectURL = vi.fn();
let mimeType: string;
let contentType: string;
let accessible: boolean;
let metadataReads: {
  role: string | null;
  variables: Record<string, unknown>;
}[];
let storageReads: {
  role: string | null;
  authorization: string | null;
  cache: RequestCache;
}[];
const server = setupServer(
  http.post('https://local.auth.local.nhost.run/v1/token', () =>
    HttpResponse.json({ ...mockSession }),
  ),
  nhostGraphQLLink.query(
    'dashboardSupportInlineAttachment',
    ({ request, variables }) => {
      metadataReads.push({
        role: request.headers.get('x-hasura-role'),
        variables,
      });
      return HttpResponse.json({
        data: {
          supportAttachmentUploads: accessible
            ? [{ file: { id, name: 'diagnostic', mimeType, size: 30 } }]
            : [],
        },
      });
    },
  ),
  http.get(
    'https://local.storage.local.nhost.run/v1/files/:id',
    ({ request }) => {
      storageReads.push({
        role: request.headers.get('x-hasura-role'),
        authorization: request.headers.get('authorization'),
        cache: request.cache,
      });
      return new HttpResponse(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        { headers: { 'content-type': contentType } },
      );
    },
  ),
);
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
  metadataReads = [];
  storageReads = [];
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

describe('private inline attachments', () => {
  it.each([false, true])(
    'previews only authenticated ticket images and revokes their blob URLs (agent=%s)',
    async (agent) => {
      authorize(agent);
      const { unmount } = render(
        <SupportMarkdown
          attachmentScope={{ ticketId }}
        >{`![Screenshot](attachment:${id})`}</SupportMarkdown>,
      );
      expect(
        await screen.findByRole('img', { name: 'Screenshot' }),
      ).toHaveAttribute('src', 'blob:private-image');
      const role = agent ? 'support' : 'user';
      expect(metadataReads).toEqual([
        { role, variables: { id, scope: { ticketID: { _eq: ticketId } } } },
      ]);
      expect(storageReads).toEqual([
        {
          role,
          authorization: `Bearer ${mockSession.accessToken}`,
          cache: 'no-store',
        },
      ]);
      expect(createObjectURL.mock.calls[0][0].type).toBe('image/png');
      unmount();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:private-image');
    },
  );

  it('previews agent-owned draft images as user, not support', async () => {
    authorize(true);
    render(
      <SupportMarkdown
        attachmentScope={{ draftId }}
      >{`![Draft screenshot](attachment:${id})`}</SupportMarkdown>,
    );
    await screen.findByRole('img', { name: 'Draft screenshot' });
    expect(metadataReads[0]).toEqual({
      role: 'user',
      variables: { id, scope: { draftID: { _eq: draftId } } },
    });
    expect(storageReads[0].role).toBe('user');
  });

  it('downloads an inline file link with authentication and an inert MIME type', async () => {
    mimeType = 'text/plain';
    contentType = 'text/plain';
    const save = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    render(
      <SupportMarkdown
        attachmentScope={{ ticketId }}
      >{`[Logs](attachment:${id})`}</SupportMarkdown>,
    );
    await new TestUserEvent().click(
      await screen.findByRole('link', { name: 'Logs' }),
    );
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(createObjectURL.mock.calls[0][0].type).toBe(
      'application/octet-stream',
    );
    expect(storageReads[0]).toMatchObject({ role: 'user', cache: 'no-store' });
  });

  it('does not fetch a file outside the current ticket or draft', async () => {
    accessible = false;
    render(
      <SupportMarkdown
        attachmentScope={{ ticketId }}
      >{`![Private](attachment:${id})`}</SupportMarkdown>,
    );
    await screen.findByText('[Attachment unavailable: Private]');
    expect(storageReads).toEqual([]);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it.each(['image/svg+xml', 'text/html'])(
    'keeps %s attachments downloadable instead of embedding them',
    async (type) => {
      mimeType = type;
      contentType = type;
      render(
        <SupportMarkdown
          attachmentScope={{ ticketId }}
        >{`![Untrusted](attachment:${id})`}</SupportMarkdown>,
      );
      await screen.findByRole('link', { name: 'Untrusted' });
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(storageReads).toEqual([]);
      expect(createObjectURL).not.toHaveBeenCalled();
    },
  );

  it('does not embed bytes with a mismatched content type', async () => {
    contentType = 'text/html';
    render(
      <SupportMarkdown
        attachmentScope={{ ticketId }}
      >{`![Not a PNG](attachment:${id})`}</SupportMarkdown>,
    );
    await screen.findByRole('link', { name: 'Not a PNG' });
    await waitFor(() => expect(storageReads).toHaveLength(1));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('hides a previously loaded image and revokes its URL when access is lost', async () => {
    render(
      <SupportMarkdown
        attachmentScope={{ ticketId }}
      >{`![Screenshot](attachment:${id})`}</SupportMarkdown>,
    );
    await screen.findByRole('img', { name: 'Screenshot' });
    accessible = false;
    await queryClient.invalidateQueries({ queryKey: ['support'] });
    await screen.findByText('[Attachment unavailable: Screenshot]');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:private-image');
  });
});
