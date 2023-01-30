import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import type {
  Files_Order_By as FilesOrderBy,
  GetFilesQuery,
} from '@/utils/__generated__/graphql';
import { useGetFilesQuery } from '@/utils/__generated__/graphql';
import type { QueryHookOptions } from '@apollo/client';
import { useCurrentWorkspaceAndApplication } from './useCurrentWorkspaceAndApplication';

export type UseFilesOptions = {
  /**
   * Search query to filter files.
   */
  searchString?: string;
  /**
   * Number of files to fetch.
   */
  limit?: number;
  /**
   * Offset of files to fetch.
   */
  offset?: number;
  /**
   * Order of files to fetch.
   */
  orderBy?: FilesOrderBy | FilesOrderBy[];
  /**
   * Custom options for the query.
   */
  options?: QueryHookOptions<GetFilesQuery>;
};

export default function useFiles({
  searchString,
  limit,
  offset,
  orderBy,
  options = {},
}: UseFilesOptions) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { data, previousData, ...rest } = useGetFilesQuery({
    variables: {
      where: searchString
        ? {
            name: {
              _ilike: `%${searchString}%`,
            },
          }
        : null,
      limit,
      offset,
      order_by: orderBy,
    },
    ...options,
  });

  const cachedOrFetchedFiles = data?.files || previousData?.files || [];

  return {
    files:
      currentApplication?.hasuraGraphqlAdminSecret && cachedOrFetchedFiles
        ? cachedOrFetchedFiles.map((file) => ({
            ...file,
            preview: {
              fetchBlob: async (
                init: RequestInit,
                size?: { width?: number; height?: number },
              ) => {
                const fetchUrl = `${generateAppServiceUrl(
                  currentApplication.subdomain,
                  currentApplication.region.awsName,
                  'storage',
                )}/files/${file.id}`;

                const fetchParams = new URLSearchParams();

                if (size?.width) {
                  fetchParams.set('w', size.width.toString());
                }

                if (size?.height) {
                  fetchParams.set('h', size.height.toString());
                }

                const finalUrl =
                  size && (size.width || size.height)
                    ? `${fetchUrl}?${fetchParams}`
                    : fetchUrl;

                try {
                  const response = await fetch(finalUrl, {
                    headers: {
                      'x-hasura-admin-secret':
                        process.env.NEXT_PUBLIC_ENV === 'dev'
                          ? 'nhost-admin-secret'
                          : currentApplication?.hasuraGraphqlAdminSecret,
                    },
                    mode: 'cors',
                    ...init,
                  });

                  return await response.blob();
                } catch {
                  return null;
                }
              },
              id: file.id,
              alt: file.name,
              mimeType: file.mimeType,
            },
          }))
        : [],
    ...rest,
  };
}
