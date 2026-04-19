import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Spinner } from '@/components/ui/v3/spinner';

type FetchBlob = (
  init: RequestInit,
  size?: { width?: number; height?: number },
) => Promise<Blob | null>;

export type ImageThumbnailProps = {
  fetchBlob: FetchBlob;
  blob?: Blob;
  mimeType: string;
  id: string;
  alt?: string;
};

export default function ImageThumbnail({
  fetchBlob,
  blob,
  mimeType,
  id,
  alt,
}: ImageThumbnailProps) {
  const {
    data: fetchedBlob,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['file-preview', id],
    queryFn: async ({ signal }) => {
      if (blob) {
        return blob;
      }

      const size =
        mimeType !== 'image/svg+xml' ? { width: 80, height: 40 } : undefined;

      return fetchBlob({ signal }, size);
    },
    staleTime: Infinity,
  });

  const objectUrl = useMemo(
    () => (fetchedBlob ? URL.createObjectURL(fetchedBlob) : null),
    [fetchedBlob],
  );

  useEffect(() => {
    if (!objectUrl) {
      return undefined;
    }

    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

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
        <AlertCircle className="text-error-main" /> Error
      </div>
    );
  }

  if (!objectUrl) {
    return null;
  }

  return (
    <picture className="h-full w-20">
      <source srcSet={objectUrl} type={mimeType} />
      <img
        src={objectUrl}
        alt={alt}
        className="h-full w-full object-scale-down"
      />
    </picture>
  );
}
