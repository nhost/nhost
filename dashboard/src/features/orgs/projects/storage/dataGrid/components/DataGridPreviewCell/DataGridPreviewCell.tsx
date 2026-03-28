import type { CellContext } from '@tanstack/react-table';
import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useReducer, useState } from 'react';
import { AudioPreviewIcon } from '@/components/ui/v2/icons/AudioPreviewIcon';
import { PDFPreviewIcon } from '@/components/ui/v2/icons/PDFPreviewIcon';
import { VideoPreviewIcon } from '@/components/ui/v2/icons/VideoPreviewIcon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import { Spinner } from '@/components/ui/v3/spinner';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { StoredFile } from '@/features/orgs/projects/storage/dataGrid/components/FilesDataGrid';
import { usePreviewToggle } from '@/features/orgs/projects/storage/dataGrid/hooks/usePreviewToggle';
import { cn } from '@/lib/utils';
import { getHasuraAdminSecret } from '@/utils/env';

export type PreviewProps = {
  fetchBlob: (
    init: RequestInit,
    size?: { width?: number; height?: number },
  ) => Promise<Blob | null>;
  mimeType?: string;
  alt?: string;
  blob?: Blob;
  id: string;
};

export type DataGridPreviewCellProps = Pick<
  CellContext<StoredFile, PreviewProps>,
  'getValue'
> & {
  /**
   * Preview to use when the file is not an image or blob can't be fetched
   * properly.
   *
   * @default null
   */
  fallbackPreview?: ReactNode;
  /**
   * Whether the preview is disabled
   */
  isDisabled: boolean;
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
  // relevant `objectUrl` state. Abort controller is responsible for cancelling
  // the fetch if the component is unmounted.
  useEffect(() => {
    if (!previewEnabled) {
      return undefined;
    }

    const abortController = new AbortController();

    async function generateOptimizedObjectUrl() {
      // todo: it could be more declarative if this function was called with the
      // actual preview URL here, not pre-generated in useFiles

      const size =
        mimeType !== 'image/svg+xml' ? { width: 80, height: 40 } : undefined;
      const fetchedBlob = await fetchBlob(
        { signal: abortController.signal },
        size,
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

export default function DataGridPreviewCell({
  getValue,
  fallbackPreview = null,
  isDisabled,
}: DataGridPreviewCellProps) {
  const { fetchBlob, id, mimeType, alt, blob } = getValue();
  const appClient = useAppClient();
  const { objectUrl, loading, error } = useBlob({
    fetchBlob,
    blob,
    mimeType,
  });
  const [showModal, setShowModal] = useState(false);
  const { previewEnabled } = usePreviewToggle();
  const { project } = useProject();

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

    const { body: presignedUrl } = await appClient.storage.getFilePresignedURL(
      id,
      {
        headers: {
          'x-hasura-admin-secret':
            process.env.NEXT_PUBLIC_ENV === 'dev'
              ? getHasuraAdminSecret()
              : project!.config!.hasura.adminSecret,
        },
      },
    );

    if (presignedUrl?.url) {
      if (!isPreviewable) {
        window.open(presignedUrl.url, '_blank', 'noopener noreferrer');
        return;
      }

      dispatch({ type: 'PREVIEW_FETCHED', payload: presignedUrl.url });
    } else {
      dispatch({
        type: 'PREVIEW_ERROR',
        payload: new Error('Presigned URL could not be fetched.'),
      });
    }
  }

  function handleClose(openState: boolean) {
    if (!openState) {
      setShowModal(false);
      dispatch({ type: 'CLEAR_PREVIEW' });
    }
  }

  if (loading) {
    return (
      <div className="flex w-full justify-center">
        <Spinner className="mx-auto h-4 w-4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="box !text-error-main grid w-full grid-flow-col items-center justify-center gap-1 text-center">
        <FileText className="text-error-main" /> Error
      </div>
    );
  }
  return (
    <Dialog open={showModal} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={alt}
          disabled={isDisabled}
          onClick={handleOpenPreview}
          className={cn('flex h-full w-full items-center justify-center', {
            'cursor-not-allowed': isDisabled,
          })}
        >
          {!isDisabled &&
          previewEnabled &&
          mimeType &&
          previewableImages.includes(mimeType) &&
          objectUrl ? (
            <picture className="h-full w-20">
              <source srcSet={objectUrl} type={mimeType} />
              <img
                src={objectUrl}
                alt={alt}
                className="h-full w-full object-scale-down"
              />
            </picture>
          ) : (
            <>
              {isVideo && <VideoPreviewIcon className="h-5 w-5" />}

              {isAudio && <AudioPreviewIcon className="h-5 w-5" />}

              {mimeType === 'application/pdf' && (
                <PDFPreviewIcon className="h-5 w-5" />
              )}

              {!isVideo &&
                !isAudio &&
                mimeType !== 'application/pdf' &&
                fallbackPreview}
            </>
          )}
        </button>
      </DialogTrigger>
      <DialogContent
        closeButtonClassName={cn({ 'text-white': isVideo || isAudio })}
        className={cn(
          { 'bg-checker-pattern': !isJson && !previewError },
          { 'p-0': isVideo || isAudio },
          isAudio ? '!w-auto' : 'h-[90vh] min-w-[96vw]',
          'flex items-center justify-center overflow-hidden rounded-md',
        )}
      >
        <DialogTitle className="hidden">{alt}</DialogTitle>
        <DialogDescription className="hidden">{alt}</DialogDescription>
        {previewLoading && !previewUrl && (
          <Spinner
            className={cn('h-5 w-5', {
              '!stroke-[#1e324b]': !isJson,
            })}
            wrapperClassName={cn('flex-row gap-1 text-xs', {
              'text-disabled': isJson,
              'text-gray-600': !isJson,
            })}
          >
            Loading preview...
          </Spinner>
        )}
        {previewError && (
          <div className="!text-error-main px-6 py-3.5 pr-12 text-start font-medium">
            <p>Error: Preview can&apos;t be loaded.</p>

            <p>{previewError?.message}</p>
          </div>
        )}
        {previewUrl && isImage && (
          <picture className="flex h-full max-h-full items-center justify-center">
            <source srcSet={previewUrl} type={mimeType} />
            <img
              src={previewUrl}
              alt={alt}
              className="h-full max-w-full object-contain"
            />
          </picture>
        )}
        {previewUrl && isVideo && (
          <video
            autoPlay
            controls
            className="h-full w-full rounded-sm bg-black"
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
          mimeType &&
          !previewableImages.includes(mimeType) &&
          !isVideo &&
          !isAudio && (
            <iframe
              src={previewUrl}
              className="h-near-screen w-full"
              title="File preview"
            />
          )}
      </DialogContent>
    </Dialog>
  );
}
