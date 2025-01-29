import { Modal } from '@/components/ui/v1/Modal';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { IconButton } from '@/components/ui/v2/IconButton';
import { AudioPreviewIcon } from '@/components/ui/v2/icons/AudioPreviewIcon';
import { FilePreviewIcon } from '@/components/ui/v2/icons/FilePreviewIcon';
import { PDFPreviewIcon } from '@/components/ui/v2/icons/PDFPreviewIcon';
import { VideoPreviewIcon } from '@/components/ui/v2/icons/VideoPreviewIcon';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { usePreviewToggle } from '@/features/orgs/projects/storage/dataGrid/hooks/usePreviewToggle';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useEffect, useReducer, useState } from 'react';
import type { CellProps } from 'react-table';

export type PreviewProps = {
  fetchBlob: (
    init?: RequestInit,
    size?: { width?: number; height?: number },
  ) => Promise<Blob | null>;
  mimeType?: string;
  alt?: string;
  blob?: Blob;
  id?: string;
};

export type DataGridPreviewCellProps<TData extends object> = CellProps<
  TData,
  PreviewProps
> & {
  /**
   * Preview to use when the file is not an image or blob can't be fetched
   * properly.
   *
   * @default null
   */
  fallbackPreview?: ReactNode;
};

function useBlob({
  fetchBlob,
  blob,
  mimeType,
}: Pick<PreviewProps, 'fetchBlob' | 'blob' | 'mimeType'>) {
  const [objectUrl, setObjectUrl] = useState<string>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState<boolean>(false);
  const { previewEnabled } = usePreviewToggle();

  // This side-effect fetches the blob of the file from the server and sets the
  // relevant `objectUrl` state. Abort controller is reponsible for cancelling
  // the fetch if the component is unmounted.
  useEffect(() => {
    if (!previewEnabled) {
      return undefined;
    }

    const abortController = new AbortController();

    async function generateOptimizedObjectUrl() {
      // todo: it could be more declarative if this function was called with the
      // actual preview URL here, not pre-generated in useFiles
      const fetchedBlob = await fetchBlob(
        { signal: abortController.signal },
        mimeType !== 'image/svg+xml' && { width: 80, height: 40 },
      );

      if (fetchedBlob) {
        return URL.createObjectURL(fetchedBlob);
      }

      return undefined;
    }

    async function generateObjectUrl() {
      setLoading(false);
      setError(undefined);

      if (objectUrl || (mimeType && !mimeType?.startsWith('image'))) {
        return;
      }

      if (blob) {
        setObjectUrl(URL.createObjectURL(blob));

        return;
      }

      try {
        setLoading(true);

        const generatedObjectUrl = await generateOptimizedObjectUrl();

        if (!abortController.signal.aborted) {
          setObjectUrl(generatedObjectUrl);
        }
      } catch (generateError) {
        if (!abortController.signal.aborted) {
          setError(generateError);
        }
      }

      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }

    generateObjectUrl();

    return () => abortController.abort();
  }, [blob, fetchBlob, objectUrl, mimeType, previewEnabled]);

  return { objectUrl, error, loading };
}

const previewableImages = [
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
];

const previewableVideos = [
  'video/mp4',
  'video/x-m4v',
  'video/3gpp',
  'video/3gpp2',
];

const previewableFileTypes = [
  ...previewableImages,
  ...previewableVideos,
  'audio/',
  'application/json',
];

function previewReducer(
  state: { loading: boolean; error?: Error; data?: string },
  action:
    | { type: 'PREVIEW_LOADING' }
    | { type: 'CLEAR_PREVIEW' }
    | { type: 'PREVIEW_FETCHED'; payload: string }
    | { type: 'PREVIEW_ERROR'; payload: Error },
): { loading: boolean; error?: Error; data?: string } {
  switch (action.type) {
    case 'PREVIEW_LOADING':
      return { ...state, loading: true, error: undefined, data: undefined };
    case 'PREVIEW_FETCHED':
      return {
        ...state,
        loading: false,
        error: undefined,
        data: action.payload,
      };
    case 'PREVIEW_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload,
        data: undefined,
      };
    case 'CLEAR_PREVIEW':
      return { ...state, loading: false, error: undefined, data: undefined };
    default:
      return { ...state };
  }
}

export default function DataGridPreviewCell<TData extends object>({
  value: { fetchBlob, id, mimeType, alt, blob },
  fallbackPreview = null,
}: DataGridPreviewCellProps<TData>) {
  const { project } = useProject();
  const appClient = useAppClient();
  const { objectUrl, loading, error } = useBlob({
    fetchBlob,
    blob,
    mimeType,
  });
  const [showModal, setShowModal] = useState(false);
  const { previewEnabled } = usePreviewToggle();

  const [
    { loading: previewLoading, error: previewError, data: previewUrl },
    dispatch,
  ] = useReducer(previewReducer, {
    loading: false,
    error: undefined,
    data: undefined,
  });

  const isPreviewable = previewableFileTypes.some(
    (type) => mimeType?.startsWith(type) || mimeType === type,
  );

  const isVideo = mimeType?.startsWith('video');
  const isAudio = mimeType?.startsWith('audio');
  const isImage = mimeType?.startsWith('image');
  const isJson = mimeType === 'application/json';

  async function handleOpenPreview() {
    if (!mimeType) {
      dispatch({
        type: 'PREVIEW_ERROR',
        payload: new Error('mimeType is not defined.'),
      });

      return;
    }

    if (isPreviewable) {
      setShowModal(true);
      dispatch({ type: 'PREVIEW_LOADING' });
    }

    const { presignedUrl } = await appClient.storage
      .setAdminSecret(project?.config?.hasura.adminSecret)
      .getPresignedUrl({ fileId: id });

    if (!presignedUrl) {
      dispatch({
        type: 'PREVIEW_ERROR',
        payload: new Error('Presigned URL could not be fetched.'),
      });
      return;
    }

    if (!isPreviewable) {
      window.open(presignedUrl.url, '_blank', 'noopener noreferrer');
      return;
    }

    dispatch({ type: 'PREVIEW_FETCHED', payload: presignedUrl.url });
  }

  if (loading) {
    return <ActivityIndicator delay={500} className="mx-auto" />;
  }

  if (error) {
    return (
      <Box
        className="grid w-full grid-flow-col items-center justify-center gap-1 text-center"
        sx={{ color: 'error.main' }}
      >
        <FilePreviewIcon error /> Error
      </Box>
    );
  }

  return (
    <>
      <Modal
        wrapperClassName="items-center"
        showModal={showModal}
        close={() => setShowModal(false)}
        afterLeave={() => dispatch({ type: 'CLEAR_PREVIEW' })}
        className={clsx(
          previewableImages.includes(mimeType) || isVideo || isAudio
            ? 'mx-12 flex h-screen items-center justify-center'
            : 'mt-4 inline-block h-near-screen w-full px-12',
        )}
      >
        <Box
          className={clsx(
            !isJson && 'bg-checker-pattern',
            'relative mx-auto flex overflow-hidden rounded-md',
          )}
          sx={{
            backgroundColor: isJson && 'background.default',
            color: 'text.primary',
          }}
        >
          {!previewLoading && (
            <IconButton
              aria-label="Close"
              variant="borderless"
              color="secondary"
              className="absolute right-2 top-2 z-50 p-2"
              sx={{
                [`&:hover, &:active, &:focus`]: {
                  backgroundColor: (theme) => {
                    if (isAudio || isVideo || isJson) {
                      return 'common.black';
                    }

                    return theme.palette.mode === 'dark'
                      ? 'grey.800'
                      : 'grey.200';
                  },
                },
              }}
              onClick={() => setShowModal(false)}
            >
              <XIcon
                className="h-5 w-5"
                sx={{
                  color: (theme) => {
                    if (isAudio || isVideo || isJson) {
                      return 'common.white';
                    }

                    return theme.palette.mode === 'dark'
                      ? 'grey.100'
                      : 'grey.700';
                  },
                }}
              />
            </IconButton>
          )}

          {previewLoading && !previewUrl && (
            <ActivityIndicator
              delay={500}
              className="mx-auto"
              label="Loading preview..."
            />
          )}

          {previewError && (
            <Box
              className="px-6 py-3.5 pr-12 text-start font-medium"
              sx={{ color: 'error.main' }}
            >
              <p>Error: Preview can&apos;t be loaded.</p>

              <p>{previewError.message}</p>
            </Box>
          )}

          {previewUrl && isImage && (
            <picture className="h-auto max-h-near-screen min-h-38 min-w-38">
              <source srcSet={previewUrl} type={mimeType} />
              <img
                src={previewUrl}
                alt={alt}
                className="h-full w-full object-scale-down"
              />
            </picture>
          )}

          {previewUrl && isVideo && (
            <video
              autoPlay
              controls
              className="h-auto max-h-near-screen w-full bg-black"
            >
              <track kind="captions" />
              <source src={previewUrl} type={mimeType} />
              Your browser does not support the video tag.
            </video>
          )}

          {previewUrl && isAudio && (
            <audio autoPlay controls className="h-28 bg-black">
              <track kind="captions" />
              <source src={previewUrl} type={mimeType} />
              Your browser does not support the audio tag.
            </audio>
          )}

          {!previewLoading &&
            previewUrl &&
            !previewableImages.includes(mimeType) &&
            !isVideo &&
            !isAudio && (
              <iframe
                src={previewUrl}
                className="h-near-screen w-full"
                title="File preview"
              />
            )}
        </Box>
      </Modal>

      <div className="flex h-full w-full justify-center">
        {previewEnabled && previewableImages.includes(mimeType) && objectUrl ? (
          <button
            type="button"
            aria-label={alt}
            onClick={handleOpenPreview}
            className="mx-auto h-full"
          >
            <picture className="h-full w-20">
              <source srcSet={objectUrl} type={mimeType} />
              <img
                src={objectUrl}
                alt={alt}
                className="h-full w-full object-scale-down"
              />
            </picture>
          </button>
        ) : null}

        {(!previewableImages.includes(mimeType) ||
          !objectUrl ||
          !previewEnabled) && (
          <button
            type="button"
            onClick={handleOpenPreview}
            aria-label={alt}
            className="grid h-full w-full items-center justify-center self-center"
          >
            {isVideo && <VideoPreviewIcon className="h-5 w-5" />}

            {isAudio && <AudioPreviewIcon className="h-5 w-5" />}

            {mimeType === 'application/pdf' && (
              <PDFPreviewIcon className="h-5 w-5" />
            )}

            {!isVideo &&
              !isAudio &&
              mimeType !== 'application/pdf' &&
              fallbackPreview}
          </button>
        )}
      </div>
    </>
  );
}
