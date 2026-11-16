import { type DocumentNode, print } from 'graphql';
import { useAuth } from '@/providers/Auth';
import { useNhostClient } from '@/providers/nhost';

export type SupportRole = 'user' | 'support_agent';

export function useSupportSession() {
  const { user, session } = useAuth();
  const nhost = useNhostClient();
  const allowedRoles =
    session?.decodedToken['https://hasura.io/jwt/claims']?.[
      'x-hasura-allowed-roles'
    ];
  const isAgent =
    Array.isArray(allowedRoles) && allowedRoles.includes('support_agent');
  const role: SupportRole = isAgent ? 'support_agent' : 'user';
  const queryKey = ['support', user?.id, role] as const;

  async function request<TData>(
    document: DocumentNode,
    variables: Record<string, unknown>,
    signal?: AbortSignal,
    requestRole: SupportRole = role,
  ): Promise<TData> {
    if (!user || nhost.getUserSession()?.user?.id !== user.id) {
      throw new Error('Your session changed. Please sign in again.');
    }
    const activeSession = await nhost.refreshSession(60);
    if (
      !activeSession ||
      activeSession.user?.id !== user.id ||
      nhost.getUserSession()?.user?.id !== user.id
    ) {
      throw new Error('Your session changed. Please sign in again.');
    }
    signal?.throwIfAborted();
    // Pin this request to the session we checked, even if the account switches
    // while token renewal is in flight. Never change the shared client's role.
    const response = await nhost.graphql.request<TData>(
      { query: print(document), variables },
      {
        headers: {
          Authorization: `Bearer ${activeSession.accessToken}`,
          'x-hasura-role': requestRole,
        },
        signal,
      },
    );
    if (nhost.getUserSession()?.user?.id !== user.id) {
      throw new Error('Your session changed. Please sign in again.');
    }
    if (!response.body.data) {
      throw new Error('Support is unavailable. Please try again.');
    }
    return response.body.data;
  }

  return { user, isAgent, role, queryKey, request };
}
