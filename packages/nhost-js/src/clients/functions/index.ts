import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  RawAxiosRequestHeaders
} from 'axios'
import { urlFromSubdomain } from '../../utils/helpers'
import { NhostClientConstructorParams } from '../../utils/types'
import {
  DeprecatedNhostFunctionCallResponse,
  NhostFunctionCallConfig,
  NhostFunctionCallResponse,
  NhostFunctionsConstructorParams
} from './types'

export * from './types'
/**
 * Creates a client for Functions from either a subdomain or a URL
 */
export function createFunctionsClient(params: NhostClientConstructorParams) {
  const functionsUrl =
    'subdomain' in params || 'backendUrl' in params
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
  private instance: AxiosInstance
  private accessToken: string | null
  private adminSecret?: string

  constructor(params: NhostFunctionsConstructorParams) {
    const { url, adminSecret } = params

    this.url = url
    this.accessToken = null
    this.adminSecret = adminSecret
    this.instance = axios.create({
      baseURL: url
    })
  }

  /** @deprecated Axios will be replaced by cross-fetch in the near future. Only the headers configuration will be kept. */
  async call<T = unknown, D = any>(
    url: string,
    data?: D,
    config?: (NhostFunctionCallConfig | AxiosRequestConfig) & { useAxios?: true }
  ): Promise<DeprecatedNhostFunctionCallResponse<T>>

  async call<T = unknown, D = any>(
    url: string,
    data: D,
    config?: NhostFunctionCallConfig & { useAxios: false }
  ): Promise<NhostFunctionCallResponse<T>>

  /**
   * Use `nhost.functions.call` to call (sending a POST request to) a serverless function.
   *
   * @example
   * ```ts
   * await nhost.functions.call('send-welcome-email', { email: 'joe@example.com', name: 'Joe Doe' })
   * ```
   *
   * @docs https://docs.nhost.io/reference/javascript/nhost-js/functions/call
   */
  async call<T = unknown, D = any>(
    url: string,
    data: D,
    {
      useAxios = true,
      ...config
    }: (AxiosRequestConfig | NhostFunctionCallConfig) & { useAxios?: boolean } = {}
  ): Promise<DeprecatedNhostFunctionCallResponse<T> | NhostFunctionCallResponse> {
    if (useAxios) {
      console.warn(
        'nhost.functions.call() will no longer use Axios in the near future. Please add `useAxios: false` in the config argument to use the new implementation.'
      )
    }
    const headers = {
      ...this.generateAccessTokenHeaders(),
      ...config?.headers
    }

    let res
    try {
      res = await this.instance.post<T, AxiosResponse<T>, D>(url, data, { ...config, headers })
    } catch (error) {
      if (error instanceof Error) {
        if (useAxios) {
          return { res: null, error }
        }
        const axiosError = error as AxiosError
        return {
          res: null,
          error: {
            error: axiosError.code || 'unknown',
            status: axiosError.status || 0,
            message: axiosError.message
          }
        }
      }
    }

    if (!res) {
      if (useAxios) {
        return {
          res: null,
          error: new Error('Unable to make post request to function')
        }
      }
      return {
        res: null,
        error: {
          error: 'invalid-response',
          status: 0,
          message: 'Unable to make post request to function'
        }
      }
    }

    if (useAxios) {
      return { res, error: null }
    }
    return {
      res: {
        status: res.status,
        statusText: res.statusText,
        data: res.data
      },
      error: null
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

  private generateAccessTokenHeaders(): RawAxiosRequestHeaders {
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
