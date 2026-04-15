import type { ReactNode } from 'react';
import { previewableImages } from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell/constants';
import ImageThumbnail from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell/ImageThumbnail';
import {
  AudioIcon,
  PdfIcon,
  VideoIcon,
} from '@/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell/icons';
import { usePreviewToggle } from '@/features/orgs/projects/storage/dataGrid/hooks/usePreviewToggle';
import { cn } from '@/lib/utils';

type FetchBlob = (
  init: RequestInit,
  size?: { width?: number; height?: number },
) => Promise<Blob | null>;

export type ViewFileButtonProps = {
  fetchBlob: FetchBlob;
  blob?: Blob;
  mimeType?: string;
  id: string;
  alt?: string;
  fallbackPreview?: ReactNode;
  isDisabled: boolean;
  onClick: () => void;
};

export default function ViewFileButton({
  fetchBlob,
  blob,
  mimeType,
  id,
  alt,
  fallbackPreview = null,
  isDisabled,
  onClick,
}: ViewFileButtonProps) {
  const { previewEnabled } = usePreviewToggle();

  const isVideo = mimeType?.startsWith('video');
  const isAudio = mimeType?.startsWith('audio');
  const isImage = !!mimeType && previewableImages.includes(mimeType);
  const showImageThumbnail = !isDisabled && previewEnabled && isImage;

  return (
    <button
      type="button"
      aria-label={alt}
      disabled={isDisabled}
      onClick={onClick}
      className={cn('flex h-full w-full items-center justify-center', {
        'cursor-not-allowed': isDisabled,
      })}
    >
      {showImageThumbnail ? (
        <ImageThumbnail
          fetchBlob={fetchBlob}
          blob={blob}
          mimeType={mimeType!}
          id={id}
          alt={alt}
        />
      ) : (
        <>
          {isVideo && <VideoIcon className="h-5 w-5" />}
          {isAudio && <AudioIcon className="h-5 w-5" />}
          {mimeType === 'application/pdf' && <PdfIcon className="h-5 w-5" />}
          {!isVideo &&
            !isAudio &&
            mimeType !== 'application/pdf' &&
            fallbackPreview}
        </>
      )}
    </button>
  );
}
