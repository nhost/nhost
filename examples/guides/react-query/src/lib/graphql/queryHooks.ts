import { useCallback } from 'react';
import { useAuth } from '../nhost/AuthProvider';

// This wrapper returns a fetcher function that uses the authenticated nhost client
export const useAuthenticatedFetcher = <TData, TVariables>(
  document: string | { query: string; variables?: TVariables },
) => {
  const { nhost } = useAuth();

  return useCallback(
    async (variables?: TVariables): Promise<TData> => {
      // Handle both string format or document object format
      const query = typeof document === 'string' ? document : document.query;
      const documentVariables =
        typeof document === 'object' ? document.variables : undefined;
      const mergedVariables = variables || documentVariables;

      const resp = await nhost.graphql.request<TData>({
        query,
        variables: mergedVariables as Record<string, unknown>,
      });

      if (!resp.body.data) {
        throw new Error(
          `Response does not contain data: ${JSON.stringify(resp.body)}`,
        );
      }

      return resp.body.data;
    },
    [nhost, document],
  );
};
