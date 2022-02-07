import axios, { AxiosResponse } from 'axios'
import { AnyEventObject } from 'xstate'
import { NhostContext } from './context'

type Service = (context: NhostContext, event: AnyEventObject) => Promise<any>

export const createBackendServices: (backendUrl: string) => Record<string, Service> = (
  backendUrl
) => {
  const client = axios.create({ baseURL: backendUrl })
  const postRequest = async <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D
  ): Promise<R> => {
    const result = await client.post(url, data)
    return result.data
  }
  // post<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R>;
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
    registerUser: ({ email, password }) =>
      postRequest('/v1/auth/signup/email-password', {
        email,
        password
      }),

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
