import axios, { AxiosError } from 'axios'

import { ErrorPayload, NETWORK_ERROR_CODE } from './errors'

export const nhostApiClient = (backendUrl: string) => {
  const client = axios.create({ baseURL: backendUrl })

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message: string; error?: string; statusCode?: number }>) =>
      Promise.reject<{ error: ErrorPayload }>({
        error: {
          message:
            error.response?.data?.message ??
            error.message ??
            error.request.responseText ??
            JSON.stringify(error),
          status: error.response?.status ?? error.response?.data?.statusCode ?? NETWORK_ERROR_CODE,
          error: error.response?.data?.error || error.request.statusText || 'network'
        }
      })
  )
  return client
}
