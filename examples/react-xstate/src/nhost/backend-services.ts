import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { AnyEventObject } from 'xstate'
import { NhostContext } from './context'

// TODO better event types
type Service = (context: NhostContext, event: AnyEventObject) => Promise<any>

export type ApiError = {
  error: string
  status: number
  message: string
}

export type AxiosErrorResponseEvent = {
  type: string
  data: { error: ApiError }
}

export type ErrorEvent = { type: string; error: ApiError }

export const nhostApiClient = (backendUrl: string) => {
  const client = axios.create({ baseURL: backendUrl, timeout: 10_000 })

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message: string; error?: string; statusCode?: number }>) =>
      Promise.reject({
        error: {
          message:
            error.response?.data?.message ??
            error.message ??
            error.request.responseText ??
            JSON.stringify(error),
          status: error.response?.status ?? error.response?.data.statusCode ?? 0,
          error: error.response?.data.error || error.request.statusText || 'network'
        }
      })
  )
  return client
}

export const createBackendServices: (client: AxiosInstance) => Record<string, Service> = (
  client
) => {
  const postRequest = async <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>
  ): Promise<R> => {
    const result = await client.post(url, data, config)
    return result.data
  }

  return {
    // TODO options
    signInPassword: ({ email, password }) =>
      postRequest('/v1/auth/signin/email-password', {
        email,
        password
      }),

    signInPasswordlessEmail: ({ email }) =>
      postRequest('/v1/auth/signin/passwordless/email', {
        email
      }),

    signout: (ctx, e) =>
      postRequest('/v1/auth/signout', {
        refreshToken: ctx.refreshToken.value,
        all: !!e.all
      }),

    //   TODO options
    registerUser: ({ email, password }) => {
      console.log('Register')
      return postRequest('/v1/auth/signup/email-password', {
        email,
        password
      })
    },
    refreshToken: ({ refreshToken: { value } }) =>
      postRequest('/v1/auth/token', {
        refreshToken: value
      }),

    validateNewToken: (_, event) =>
      postRequest('/v1/auth/token', {
        refreshToken: event.token
      })
  }
}
