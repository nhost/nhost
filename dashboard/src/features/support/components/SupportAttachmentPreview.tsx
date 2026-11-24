import { useQuery } from '@tanstack/react-query';
import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  type SupportRole,
  useSupportSession,
} from '@/features/support/hooks/use-support-session';
import {
  isSupportImage,
  MAX_SUPPORT_ATTACHMENT_SIZE,
  type SupportAttachmentFile,
} from '@/features/support/utils/attachments';
import { cn } from '@/lib/utils';

function attachmentIcon(file?: SupportAttachmentFile | null) {
  const mime = file?.mimeType?.toLowerCase() ?? '';
  const name = file?.name?.toLowerCase() ?? '';
  if (mime.startsWith('image/')) {
    return { Icon: FileImage, label: 'Image file' };
  }
  if (mime.startsWith('audio/')) {
    return { Icon: FileAudio, label: 'Audio file' };
  }
  if (mime.startsWith('video/')) {
    return { Icon: FileVideo, label: 'Video file' };
  }
  if (
    /(zip|gzip|tar|rar|7z|compressed)/.test(mime) ||
    /\.(zip|gz|tgz|tar|rar|7z)$/.test(name)
  ) {
    return { Icon: FileArchive, label: 'Archive file' };
  }
  if (
    /(spreadsheet|excel|csv)/.test(mime) ||
    /\.(csv|tsv|xlsx?|ods)$/.test(name)
  ) {
    return { Icon: FileSpreadsheet, label: 'Spreadsheet' };
  }
  if (
    /(json|xml|javascript|html)/.test(mime) ||
    /\.(json|xml|[cm]?[jt]sx?|py|go|sh|sql|ya?ml)$/.test(name)
  ) {
    return { Icon: FileCode2, label: 'Code file' };
  }
  if (mime === 'application/pdf') {
    return { Icon: FileText, label: 'PDF document' };
  }
  if (
    mime.startsWith('text/') ||
    /(word|document|rtf)/.test(mime) ||
    /\.(txt|log|md|docx?|rtf|odt)$/.test(name)
  ) {
    return { Icon: FileText, label: 'Text document' };
  }
  return { Icon: File, label: 'File' };
}

interface SupportAttachmentPreviewProps {
  file?: SupportAttachmentFile | null;
  requestRole?: SupportRole;
  variant?: 'list' | 'editor';
  className?: string;
  label?: string;
}

export default function SupportAttachmentPreview({
  file,
  requestRole,
  variant = 'list',
  className,
  label: accessibleLabel,
}: SupportAttachmentPreviewProps) {
  const { user, role, downloadAttachment } = useSupportSession();
  const actorRole = requestRole ?? role;
  const eligible = !!file && isSupportImage(file.mimeType ?? '');
  const container = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [image, setImage] = useState<{ blob: Blob; url: string }>();
  const [failedURL, setFailedURL] = useState<string>();
  useEffect(() => {
    if (!eligible || !container.current) {
      return undefined;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!!entry?.isIntersecting);
      },
      { rootMargin: '200px' },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [eligible]);
  const preview = useQuery({
    queryKey: [
      'support',
      user?.id,
      actorRole,
      'attachment-thumbnail',
      file?.id,
      file?.mimeType,
    ],
    queryFn: async ({ signal }) => {
      if (!file || !isSupportImage(file.mimeType ?? '')) {
        throw new Error('This file cannot be previewed.');
      }
      const blob = await downloadAttachment(file.id, actorRole, signal, {
        w: 128,
        h: 128,
        q: 75,
        f: 'webp',
      });
      if (
        blob.type !== 'image/webp' ||
        blob.size === 0 ||
        blob.size > MAX_SUPPORT_ATTACHMENT_SIZE
      ) {
        throw new Error('The image preview is unavailable.');
      }
      return blob;
    },
    enabled: !!user && eligible && visible,
    cacheTime: 0,
    staleTime: 30000,
    retry: false,
    keepPreviousData: false,
    refetchInterval: 30000,
  });
  const blob = eligible && !preview.isError ? preview.data : undefined;
  useEffect(() => {
    if (!blob) {
      return undefined;
    }
    const url = URL.createObjectURL(blob);
    setImage({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  const { Icon, label } = attachmentIcon(file);
  return (
    <span
      ref={container}
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/50',
        variant === 'editor' ? 'max-h-40 max-w-full' : 'size-16',
        className,
      )}
      aria-busy={preview.isFetching}
    >
      {blob && image?.blob === blob && image.url !== failedURL ? (
        // biome-ignore lint/performance/noImgElement: Private authenticated blob URLs must not go through the image optimizer.
        <img
          src={image.url}
          alt={
            accessibleLabel ??
            (variant === 'editor'
              ? (file?.name ?? 'attachment')
              : `Preview of ${file?.name ?? 'attachment'}`)
          }
          width={variant === 'editor' ? 160 : 64}
          height={variant === 'editor' ? 160 : 64}
          loading="lazy"
          draggable={variant !== 'editor'}
          className={cn(
            'object-contain',
            variant === 'editor'
              ? 'h-40 max-h-40 w-auto max-w-full'
              : 'size-full',
          )}
          onError={() => setFailedURL(image.url)}
        />
      ) : (
        <Icon
          className="size-6 text-muted-foreground"
          role="img"
          aria-hidden={false}
          aria-label={
            accessibleLabel ?? `${label}: ${file?.name ?? 'attachment'}`
          }
        />
      )}
    </span>
  );
}
