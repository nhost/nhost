import fetch from 'isomorphic-unfetch'
import { buildUrl, urlFromSubdomain } from '../../utils/helpers'
import { NhostClientConstructorParams } from '../../utils/types'
import {
  NhostFunctionCallConfig,
  NhostFunctionCallResponse,
  NhostFunctionsConstructorParams
} from './types'
/**
 * Creates a client for Functions from either a subdomain or a URL
 */
export function createFunctionsClient(params: NhostClientConstructorParams) {
  const functionsUrl =
    'subdomain' in params
      ? urlFromSubdomain(params, 'functions')
      : params.functionsUrl

  if (!functionsUrl) {
    throw new Error('Please provide `subdomain` or `functionsUrl`.')
  }

  return new NhostFunctionsClient({ url: functionsUrl, ...params })
}

/**
 * @alias Functions
 */
export class NhostFunctionsClient {
  readonly url: string
  private accessToken: string | null
  private adminSecret?: string

  constructor(params: NhostFunctionsConstructorParams) {
    const { url, adminSecret } = params

    this.url = url
    this.accessToken = null
    this.adminSecret = adminSecret
  }

  /**
   * Use `nhost.functions.call` to call (sending a POST request to) a serverless function. Use generic
   * types to specify the expected response data, request body and error message.
   *
   * @example
   * ### Without generic types
   * ```ts
   * await nhost.functions.call('send-welcome-email', { email: 'joe@example.com', name: 'Joe Doe' })
   * ```
   *
   * @example
   * ### Using generic types
   * ```ts
   * type Data = {
   *   message: string
   * }
   *
   * type Body = {
   *   email: string
   *   name: string
   * }
   *
   * type ErrorMessage = {
   *   details: string
   * }
   *
   * // The function will only accept a body of type `Body`
   * const { res, error } = await nhost.functions.call<Data, Body, ErrorMessage>(
   *   'send-welcome-email',
   *   { email: 'joe@example.com', name: 'Joe Doe' }
   * )
   *
   * // Now the response data is typed as `Data`
   * console.log(res?.data.message)
   *
   * // Now the error message is typed as `ErrorMessage`
   * console.log(error?.message.details)
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/nhost-js/functions/call
   */
  async call<TData = unknown, TBody = any, TErrorMessage = any>(
    url: string,
    body?: TBody | null,
    config?: NhostFunctionCallConfig
  ): Promise<NhostFunctionCallResponse<TData, TErrorMessage>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...this.generateAccessTokenHeaders(),
      ...config?.headers
    }

    const fullUrl = buildUrl(this.url, url)

    try {
      const result = await fetch(fullUrl, {
        body: body ? JSON.stringify(body) : null,
        headers,
        method: 'POST'
      })

      if (!result.ok) {
        let message: TErrorMessage

        if (result.headers.get('content-type')?.includes('application/json')) {
          message = await result.json()
        } else {
          message = (await result.text()) as unknown as TErrorMessage
        }

        return {
          res: null,
          error: {
            message,
            error: result.statusText,
            status: result.status
          }
        }
      }

      let data: TData

      if (result.headers.get('content-type')?.includes('application/json')) {
        data = await result.json()
      } else {
        data = (await result.text()) as unknown as TData
      }

      return {
        res: { data, status: result.status, statusText: result.statusText },
        error: null
      }
    } catch (e) {
      const error = e as Error
      return {
        res: null,
        error: {
          message: error.message as unknown as TErrorMessage,
          status: error.name === 'AbortError' ? 0 : 500,
          error: error.name === 'AbortError' ? 'abort-error' : 'unknown'
        }
      }
    }
  }

  /**
   * Use `nhost.functions.setAccessToken` to a set an access token to be used in subsequent functions requests. Note that if you're signin in users with `nhost.auth.signIn()` the access token will be set automatically.
   *
   * @example
   * ```ts
   * nhost.functions.setAccessToken('some-access-token')
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/nhost-js/functions/set-access-token
   */
  setAccessToken(accessToken: string | undefined) {
    if (!accessToken) {
      this.accessToken = null
      return
    }

    this.accessToken = accessToken
  }

  generateAccessTokenHeaders(): NhostFunctionCallConfig['headers'] {
    if (this.adminSecret) {
      return {
        'x-hasura-admin-secret': this.adminSecret
      }
    }
    if (this.accessToken) {
      return {
        Authorization: `Bearer ${this.accessToken}`
      }
    }
    return {}
  }
}
