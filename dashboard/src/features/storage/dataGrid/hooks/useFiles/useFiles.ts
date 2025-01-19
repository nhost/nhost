import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import type {
  Files_Order_By as FilesOrderBy,
  GetFilesQuery,
} from '@/utils/__generated__/graphql';
import { useGetFilesQuery } from '@/utils/__generated__/graphql';
import type { QueryHookOptions } from '@apollo/client';
import { validate as uuidValidate } from 'uuid';

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
  const { currentProject } = useCurrentWorkspaceAndProject();

  const isUUID = uuidValidate(searchString);
  const { data, previousData, ...rest } = useGetFilesQuery({
    variables: {
      where: searchString
        ? {
            _or: [
              ...((isUUID && [{ id: { _eq: searchString } }]) || []),
              { name: { _ilike: `%${searchString}%` } },
            ],
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
      currentProject?.config?.hasura.adminSecret && cachedOrFetchedFiles
        ? cachedOrFetchedFiles.map((file) => ({
            ...file,
            preview: {
              fetchBlob: async (
                init: RequestInit,
                size?: { width?: number; height?: number },
              ) => {
                const fetchUrl = `${generateAppServiceUrl(
                  currentProject.subdomain,
                  currentProject.region,
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
                          ? getHasuraAdminSecret()
                          : currentProject?.config?.hasura.adminSecret,
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
