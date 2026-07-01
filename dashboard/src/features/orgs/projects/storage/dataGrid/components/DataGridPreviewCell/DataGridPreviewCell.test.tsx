import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  localStorageMock,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import DataGridPreviewCell from './DataGridPreviewCell';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useAppClient: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/features/orgs/projects/hooks/useAppClient', () => ({
  useAppClient: mocks.useAppClient,
}));

describe('DataGridPreviewCell and FilePreviewDialog Fallbacks', () => {
  const adminSecret = 'my-admin-secret';
  const fileId = 'test-file-id';
  const originalLocalStorage = global.localStorage;

  beforeAll(() => {
    global.localStorage = localStorageMock();
  });

  afterAll(() => {
    global.localStorage = originalLocalStorage;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    mocks.useProject.mockReturnValue({
      project: {
        config: {
          hasura: {
            adminSecret,
          },
        },
      },
    });
  });

  it('FilePreviewDialog falls back to getFile when getFilePresignedURL fails', async () => {
    const getFilePresignedURLMock = vi
      .fn()
      .mockRejectedValue(new Error('Presigned URLs disabled'));
    const mockBlob = new Blob(['image data'], { type: 'image/png' });
    const getFileMock = vi.fn().mockResolvedValue({
      body: mockBlob,
      status: 200,
    });

    mocks.useAppClient.mockReturnValue({
      storage: {
        getFilePresignedURL: getFilePresignedURLMock,
        getFile: getFileMock,
      },
    });

    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:http://localhost/test-blob-url');

    render(
      <DataGridPreviewCell
        id={fileId}
        mimeType="image/png"
        alt="Test Image"
        fetchBlob={async () => null}
        isDisabled={false}
        downloadExpiration={30}
      />,
    );

    // Open preview dialog (images are previewable)
    const button = screen.getByRole('button');
    await TestUserEvent.fireClickEvent(button);

    // Verify it tries to get presigned URL first, then falls back to getFile with admin secret
    await waitFor(() => {
      expect(getFilePresignedURLMock).toHaveBeenCalledWith(fileId, {
        headers: { 'x-hasura-admin-secret': adminSecret },
      });
      expect(getFileMock).toHaveBeenCalledWith(
        fileId,
        {},
        {
          headers: { 'x-hasura-admin-secret': adminSecret },
        },
      );
    });

    // Check that createObjectURL was called with the blob
    expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);

    // Check that preview dialog displays image with the mocked blob url
    const img = await screen.findByRole('img');
    expect(img).toHaveAttribute('src', 'blob:http://localhost/test-blob-url');
  });

  it('DataGridPreviewCell handleOpenPreview falls back to getFile and opens in new tab for non-previewable files', async () => {
    const getFilePresignedURLMock = vi
      .fn()
      .mockRejectedValue(new Error('Presigned URLs disabled'));
    const mockBlob = new Blob(['pdf data'], { type: 'application/pdf' });
    const getFileMock = vi.fn().mockResolvedValue({
      body: mockBlob,
      status: 200,
    });

    mocks.useAppClient.mockReturnValue({
      storage: {
        getFilePresignedURL: getFilePresignedURLMock,
        getFile: getFileMock,
      },
    });

    vi.spyOn(URL, 'createObjectURL').mockReturnValue(
      'blob:http://localhost/pdf-blob-url',
    );
    const windowOpenSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => null);

    render(
      <DataGridPreviewCell
        id={fileId}
        mimeType="application/pdf"
        alt="Test PDF"
        fetchBlob={async () => null}
        isDisabled={false}
        downloadExpiration={30}
      />,
    );

    // Click button to open the PDF (non-previewable type)
    const button = screen.getByRole('button');
    await TestUserEvent.fireClickEvent(button);

    // Verify fallback download and window.open is called with local blob URL
    await waitFor(() => {
      expect(getFileMock).toHaveBeenCalledWith(
        fileId,
        {},
        {
          headers: { 'x-hasura-admin-secret': adminSecret },
        },
      );
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'blob:http://localhost/pdf-blob-url',
        '_blank',
        'noopener noreferrer',
      );
    });
  });
});
