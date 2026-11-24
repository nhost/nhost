import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import SupportAttachmentPreview from '@/features/support/components/SupportAttachmentPreview';
import { mockSession } from '@/tests/mocks';
import {
  act,
  fireEvent,
  queryClient,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';

const id = '41261576-2d59-4c12-bc6e-e573bdba3af1';
const file = { id, name: 'screenshot.png', mimeType: 'image/png' };
const originalToken = mockSession.accessToken;
const originalClaims = structuredClone(mockSession.decodedToken);
const createObjectURL = vi.fn().mockReturnValue('blob:attachment-thumbnail');
const revokeObjectURL = vi.fn();
let responseType: string;
let denied: boolean;
let reads: {
  id: unknown;
  params: Record<string, string>;
  role: string | null;
  authorization: string | null;
  cache: RequestCache;
}[];
const server = setupServer(
  http.post('https://local.auth.local.nhost.run/v1/token', () =>
    HttpResponse.json({ ...mockSession }),
  ),
  http.get(
    'https://local.storage.local.nhost.run/v1/files/:id',
    ({ request, params }) => {
      reads.push({
        id: params.id,
        params: Object.fromEntries(new URL(request.url).searchParams),
        role: request.headers.get('x-hasura-role'),
        authorization: request.headers.get('authorization'),
        cache: request.cache,
      });
      if (denied) {
        return HttpResponse.json(
          { error: { message: 'Access denied' } },
          { status: 403 },
        );
      }
      return new HttpResponse(
        new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
        { headers: { 'content-type': responseType } },
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
  vi.stubGlobal('IntersectionObserver', undefined);
  queryClient.clear();
  authorize(false);
  responseType = 'image/webp';
  denied = false;
  reads = [];
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
  mockSession.accessToken = originalToken;
  mockSession.decodedToken = structuredClone(originalClaims);
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

describe('support attachment list previews', () => {
  it.each([
    { agent: false, requestRole: undefined, expectedRole: 'user' },
    { agent: true, requestRole: undefined, expectedRole: 'support' },
    { agent: true, requestRole: 'user', expectedRole: 'user' },
  ] as const)(
    'fetches private resized thumbnails as $expectedRole (agent=$agent, override=$requestRole)',
    async ({ agent, requestRole, expectedRole }) => {
      authorize(agent);
      const { unmount } = render(
        <SupportAttachmentPreview file={file} requestRole={requestRole} />,
      );
      expect(
        await screen.findByRole('img', { name: 'Preview of screenshot.png' }),
      ).toHaveAttribute('src', 'blob:attachment-thumbnail');
      expect(reads).toEqual([
        {
          id,
          params: { w: '128', h: '128', q: '75', f: 'webp' },
          role: expectedRole,
          authorization: `Bearer ${mockSession.accessToken}`,
          cache: 'no-store',
        },
      ]);
      expect(createObjectURL.mock.calls[0][0].type).toBe('image/webp');
      unmount();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:attachment-thumbnail');
    },
  );

  it.each([
    { mimeType: 'application/pdf', name: 'report.pdf', label: 'PDF document' },
    { mimeType: 'text/plain', name: 'logs.txt', label: 'Text document' },
    { mimeType: 'application/json', name: 'debug.json', label: 'Code file' },
    { mimeType: 'text/html', name: 'report.html', label: 'Code file' },
    { mimeType: 'application/zip', name: 'logs.zip', label: 'Archive file' },
    {
      mimeType: 'application/octet-stream',
      name: 'logs.tar',
      label: 'Archive file',
    },
    { mimeType: 'text/csv', name: 'report.csv', label: 'Spreadsheet' },
    { mimeType: 'audio/mpeg', name: 'recording.mp3', label: 'Audio file' },
    { mimeType: 'video/mp4', name: 'recording.mp4', label: 'Video file' },
    { mimeType: 'image/svg+xml', name: 'untrusted.svg', label: 'Image file' },
    {
      mimeType: 'application/octet-stream',
      name: 'unknown.bin',
      label: 'File',
    },
  ])(
    'shows a $label icon for $name without downloading bytes',
    ({ mimeType, name, label }) => {
      render(<SupportAttachmentPreview file={{ id, mimeType, name }} />);
      expect(
        screen
          .getByRole('img', { name: `${label}: ${name}` })
          .tagName.toLowerCase(),
      ).toBe('svg');
      expect(reads).toEqual([]);
      expect(createObjectURL).not.toHaveBeenCalled();
    },
  );

  it('loads thumbnails only near the viewport', async () => {
    let updateVisibility: IntersectionObserverCallback = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          updateVisibility = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    const { unmount } = render(<SupportAttachmentPreview file={file} />);
    expect(observe).toHaveBeenCalled();
    expect(reads).toEqual([]);
    const observer = {} as IntersectionObserver;
    const entry = { isIntersecting: true } as IntersectionObserverEntry;
    await act(async () => updateVisibility([entry], observer));
    await screen.findByRole('img', { name: 'Preview of screenshot.png' });
    expect(reads).toHaveLength(1);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it.each(['text/html', 'image/svg+xml', 'image/png'])(
    'falls back to an icon for unexpected thumbnail content type %s',
    async (mime) => {
      responseType = mime;
      render(<SupportAttachmentPreview file={file} />);
      await waitFor(() => expect(reads).toHaveLength(1));
      await waitFor(() =>
        expect(
          screen.getByRole('img', { name: 'Image file: screenshot.png' })
            .parentElement,
        ).toHaveAttribute('aria-busy', 'false'),
      );
      expect(
        screen.queryByRole('img', { name: 'Preview of screenshot.png' }),
      ).not.toBeInTheDocument();
      expect(createObjectURL).not.toHaveBeenCalled();
    },
  );

  it('falls back to the file-type icon when Storage denies the preview', async () => {
    denied = true;
    render(<SupportAttachmentPreview file={file} />);
    await waitFor(() => expect(reads).toHaveLength(1));
    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: 'Image file: screenshot.png' })
          .parentElement,
      ).toHaveAttribute('aria-busy', 'false'),
    );
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('falls back to the file-type icon when the browser cannot decode the thumbnail', async () => {
    render(<SupportAttachmentPreview file={file} />);
    fireEvent.error(
      await screen.findByRole('img', { name: 'Preview of screenshot.png' }),
    );
    expect(
      screen.getByRole('img', { name: 'Image file: screenshot.png' }),
    ).toBeInTheDocument();
  });

  it('hides and revokes a loaded thumbnail when access is revoked', async () => {
    render(<SupportAttachmentPreview file={file} />);
    await screen.findByRole('img', { name: 'Preview of screenshot.png' });
    denied = true;
    await queryClient.invalidateQueries({ queryKey: ['support'] });
    await waitFor(() =>
      expect(
        screen.queryByRole('img', { name: 'Preview of screenshot.png' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('img', { name: 'Image file: screenshot.png' }),
    ).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:attachment-thumbnail');
  });
});
