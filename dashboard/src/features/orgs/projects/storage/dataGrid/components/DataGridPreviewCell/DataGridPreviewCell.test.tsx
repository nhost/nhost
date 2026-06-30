import { vi } from 'vitest';
import { render, screen, waitFor } from '@/tests/testUtils';
import userEvent from '@testing-library/user-event';
import DataGridPreviewCell from './DataGridPreviewCell';

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
    const getFilePresignedURLMock = vi.fn().mockRejectedValue(new Error('Presigned URLs disabled'));
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

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/test-blob-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    render(
      <DataGridPreviewCell
        id={fileId}
        mimeType="image/png"
        alt="Test Image"
        fetchBlob={async () => null}
        isDisabled={false}
        downloadExpiration={30}
      />
    );

    // Open preview dialog (images are previewable)
    const button = screen.getByRole('button');
    await userEvent.click(button);

    // Verify it tries to get presigned URL first, then falls back to getFile with admin secret
    await waitFor(() => {
      expect(getFilePresignedURLMock).toHaveBeenCalledWith(fileId, {
        headers: { 'x-hasura-admin-secret': adminSecret },
      });
      expect(getFileMock).toHaveBeenCalledWith(fileId, {}, {
        headers: { 'x-hasura-admin-secret': adminSecret },
      });
    });

    // Check that createObjectURL was called with the blob
    expect(createObjectURLSpy).toHaveBeenCalledWith(mockBlob);

    // Check that preview dialog displays image with the mocked blob url
    const img = await screen.findByRole('img');
    expect(img).toHaveAttribute('src', 'blob:http://localhost/test-blob-url');
  });

  it('DataGridPreviewCell handleOpenPreview falls back to getFile and opens in new tab for non-previewable files', async () => {
    const getFilePresignedURLMock = vi.fn().mockRejectedValue(new Error('Presigned URLs disabled'));
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

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/pdf-blob-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <DataGridPreviewCell
        id={fileId}
        mimeType="application/pdf"
        alt="Test PDF"
        fetchBlob={async () => null}
        isDisabled={false}
        downloadExpiration={30}
      />
    );

    // Click button to open the PDF (non-previewable type)
    const button = screen.getByRole('button');
    await userEvent.click(button);

    // Verify fallback download and window.open is called with local blob URL
    await waitFor(() => {
      expect(getFileMock).toHaveBeenCalledWith(fileId, {}, {
        headers: { 'x-hasura-admin-secret': adminSecret },
      });
      expect(windowOpenSpy).toHaveBeenCalledWith('blob:http://localhost/pdf-blob-url', '_blank', 'noopener noreferrer');
    });
  });
});
