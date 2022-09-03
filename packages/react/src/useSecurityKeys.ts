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
  (nickname?: string): Promise<AddSecurityKeyHandlerResult>
}
interface RemoveSecurityKeyHandlerResult extends ActionErrorState, ActionSuccessState {}
interface RemoveSecurityKeyHandler {
  (id: string): Promise<RemoveSecurityKeyHandlerResult>
}

export type SecurityKey = { id: string; nickname?: string }

export interface SecurityKeysHookResult extends ActionErrorState, ActionSuccessState {
  // TODO document
  add: AddSecurityKeyHandler
  //   TODO document
  list: SecurityKey[]
  //   TODO
  remove: (id: string) => Promise<RemoveSecurityKeyHandlerResult>
}

interface SecurityKeysHook {
  (): SecurityKeysHookResult
}

/**
//  TODO document
 * Use the hook `useSecurityKeys` to list, add and remove security keys of the user.
 *
 * @example
 * ```tsx
 * const { SecurityKeys, isLoading, isSuccess, isError, error } = useSecurityKeys();
 *
 * console.log({ isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await SecurityKeys('my-new-password')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-change-password
 */
// TODO: depends on default user metadata permissions -> set default permissions into hasura auth
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
