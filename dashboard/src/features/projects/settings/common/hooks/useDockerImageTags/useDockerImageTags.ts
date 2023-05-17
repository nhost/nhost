import { useQuery } from '@tanstack/react-query';

export interface UseDockerImageTagsProps {
  /**
   * The name of the image.
   */
  image: string;
}

/**
 * Fetches the tags for the given Docker image.
 */
export default function useDockerImageTags({ image }: UseDockerImageTagsProps) {
  return useQuery<string[], Error>(
    ['docker-image-tags', image],
    async () => {
      const response = await fetch(
        `/api/fetch-docker-image-tags?image=${image}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || 'Something went wrong');
      }

      return data as string[];
    },
    { refetchOnWindowFocus: false },
  );
}
