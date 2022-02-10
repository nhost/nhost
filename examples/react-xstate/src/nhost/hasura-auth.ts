import axios, { AxiosError } from 'axios'

export type ApiError = {
  error: string
  status: number
  message: string
}

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
