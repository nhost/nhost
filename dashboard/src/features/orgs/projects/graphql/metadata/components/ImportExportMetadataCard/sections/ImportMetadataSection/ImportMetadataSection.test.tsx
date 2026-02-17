import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import { fireEvent, render, screen, waitFor } from '@/tests/testUtils';
import ImportMetadataSection from './ImportMetadataSection';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  useReplaceMetadataMutation: vi.fn(),
}));

vi.mock('react-hot-toast', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actualToast = await vi.importActual<any>('react-hot-toast');
  return {
    ...actualToast,
    toast: {
      ...actualToast.toast,
      error: mocks.toastError,
    },
  };
});

vi.mock('@/utils/constants/settings', () => ({
  getToastStyleProps: vi.fn(() => ({})),
}));

vi.mock(
  '@/features/orgs/projects/graphql/metadata/hooks/useReplaceMetadataMutation/useReplaceMetadataMutation',
  () => ({
    default: mocks.useReplaceMetadataMutation,
  }),
);

function createJsonFile(content: string, name = 'metadata.json') {
  return new File([content], name, { type: 'application/json' });
}

describe('ImportMetadataSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.useReplaceMetadataMutation.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    });
  });

  it('should open the import dialog when a valid JSON file is selected', async () => {
    render(<ImportMetadataSection />);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const validMetadata = JSON.stringify({
      version: 3,
      sources: [],
    });
    const file = createJsonFile(validMetadata);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('heading', { name: /import metadata/i }),
    ).toBeInTheDocument();
  });

  it('should show an error toast with a user-friendly message when an invalid JSON file is selected', async () => {
    render(<ImportMetadataSection />);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const file = createJsonFile('not valid json {{{');

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        'The selected file does not contain valid JSON.',
        expect.anything(),
      );
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should show an error toast when the file contains empty metadata', async () => {
    render(<ImportMetadataSection />);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const file = createJsonFile(JSON.stringify({}));

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Failed to parse metadata.',
        expect.anything(),
      );
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should show an error toast when FileReader fails to read the file', async () => {
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(
      function mock(this: FileReader) {
        setTimeout(() => {
          this.onerror?.(
            new DOMException(
              'Read failed',
              'NotReadableError',
            ) as unknown as ProgressEvent<FileReader>,
          );
        }, 0);
      },
    );

    render(<ImportMetadataSection />);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const file = createJsonFile('{}');

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Failed to read the selected file.',
        expect.anything(),
      );
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should call replaceMetadata when the import dialog is submitted', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({
      is_consistent: true,
      inconsistent_objects: [],
    });
    mocks.useReplaceMetadataMutation.mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync,
    });

    render(<ImportMetadataSection />);

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const metadata = { version: 3, sources: [] };
    const file = createJsonFile(JSON.stringify(metadata));

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata,
          allowInconsistentMetadata: false,
        }),
      );
    });
  });
});
