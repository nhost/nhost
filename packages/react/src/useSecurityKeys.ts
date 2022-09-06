import { useEffect, useState } from 'react'

import {
  ActionErrorState,
  ActionSuccessState,
  AddSecurityKeyHandlerResult,
  addSecurityKeyPromise,
  ErrorPayload,
  OTHER_ERROR_CODE
} from '@nhost/core'

import { useNhostClient } from './useNhostClient'

interface AddSecurityKeyHandler {
  (
    /** Optional human-readable name of the security key */
    nickname?: string
  ): Promise<AddSecurityKeyHandlerResult>
}
interface RemoveSecurityKeyHandlerResult extends ActionErrorState, ActionSuccessState {}
interface RemoveSecurityKeyHandler {
  (
    /** Unique identifier of the security to remove */
    id: string
  ): Promise<RemoveSecurityKeyHandlerResult>
}

export interface SecurityKey {
  id: string
  nickname?: string
}

export interface SecurityKeysHookResult extends ActionErrorState, ActionSuccessState {
  /** Add a security key to the current user with the WebAuthn API */
  add: AddSecurityKeyHandler
  /**  List the security keys of the current user */
  list: SecurityKey[]
  /** Remove the given security key from the list of allowed keys for the current user */
  remove: RemoveSecurityKeyHandler
}

interface SecurityKeysHook {
  (): SecurityKeysHookResult
}

/**
 * Use the hook `useSecurityKeys` to list, add and remove the WebAuthn security keys of the user.
 *
 * When WebAuthn is enabled, the `add` function will work as expected.
 *
 * You have to make sure the current user has correct Hasura permissions on the `auth.user_authenticators` table to list and/or remove their keys:
 *
 * - List keys: permissions to select the `id` and `nickname` columns
 * - Remove keys: permissions to delete rows
 *
 * It is recommended to add the custom check `{ user_id: { _eq: "X-Hasura-User-Id" } }` to make sure the user can only list and remove their own keys.
 *
 * @example
 * ```tsx
 * const { add, list, remove, isLoading, isSuccess, isError, error } = useSecurityKeys()
 *
 * return (
 *   <ul>
 *     {list.map(({ id, nickname }) => (
 *       <li key={id} onClick={() => remove(id)}>{nickname}</li>
 *     ))}
 *   </ul>
 * )
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-security-keys
 */
export const useSecurityKeys: SecurityKeysHook = () => {
  const nhost = useNhostClient()
  const [list, setList] = useState<SecurityKey[]>([])
  const [error, setError] = useState<ErrorPayload | null>(null)
  const isSuccess = !error
  const isError = !!error

  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const loadList = async () => {
      setIsLoading(true)
      // * Initial list
      const userId = nhost?.auth.getUser()?.id
      if (userId) {
        const query = `
          query myAuthenticators ($userId: uuid!) {
            authUserAuthenticators (where: { userId: {_eq: $userId} }) {
              id
              nickname
            }
          }
        `
        const { data, error: e } = await nhost.graphql.request<
          { authUserAuthenticators: SecurityKey[] },
          { userId: string }
        >(query, {
          userId
        })
        if (e) {
          // non-standard error
          setError({ error: 'graphq-error', message: JSON.stringify(e), status: OTHER_ERROR_CODE })
        } else if (data) {
          setList(data.authUserAuthenticators)
        }
        setIsLoading(false)
      }
    }
    loadList()
  }, [nhost])

  const add: AddSecurityKeyHandler = async (nickname) => {
    const result = await addSecurityKeyPromise(nhost.auth.client, nickname)
    const { isError, id } = result
    if (!isError && id) {
      setList(
        [...list, { id, nickname }].sort((a, b) => a.nickname?.localeCompare(b.nickname || '') || 0)
      )
    }
    return result
  }

  const remove: RemoveSecurityKeyHandler = async (id) => {
    const query = `
      mutation removeAuthenticator($id: uuid!) {
        deleteAuthUserAuthenticator(id: $id) {
          id
        }
      }
      `
    const { data, error: e } = await nhost.graphql.request<unknown, { id: string }>(query, {
      id
    })
    if (data) {
      setList(list.filter((item) => item.id !== id))
      return {
        error: null,
        isError: false,
        isSuccess: true
      }
    } else {
      return {
        // non-standard error
        error: { error: 'graphq-error', message: JSON.stringify(e), status: OTHER_ERROR_CODE },
        isError: true,
        isSuccess: false
      }
    }
  }

  return { add, remove, list, isLoading, isSuccess, isError, error }
}
