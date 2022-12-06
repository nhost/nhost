import fetch from 'cross-fetch'
import { NETWORK_ERROR_CODE } from '../errors'
import { NullableErrorResponse } from '../types'

interface FetcResponse<T> extends NullableErrorResponse {
  data: T
}

const fetchWrapper = async <T>(
  url: string,
  method: 'GET' | 'POST',
  { token, body }: { token?: string | null; body?: any } = {}
): Promise<FetcResponse<T>> => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: '*/*'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const options: RequestInit = {
    method,
    headers
  }
  if (body) {
    options.body = JSON.stringify(body)
  }
  try {
    const result = await fetch(url, options)
    if (!result.ok) {
      // console.log('not ok', url, method, token, body, await result.text())
      return Promise.reject<FetcResponse<T>>({
        error: {
          message: (await result.text()) || result.statusText,
          status: result.statusText || result.status,
          error: result.statusText
        }
      })
    }
    const data = await result.json()
    return { data, error: null }
  } catch (e) {
    const error = e as Error
    return Promise.reject<FetcResponse<T>>({
      error: {
        message: error.message ?? JSON.stringify(error),
        status: NETWORK_ERROR_CODE,
        error: 'network'
      }
    })
  }
}

export const postFetch = async <T>(
  url: string,
  body: any,
  token?: string | null
): Promise<FetcResponse<T>> => {
  return fetchWrapper<T>(url, 'POST', { token, body })
}

export const getFetch = async <T>(url: string, token?: string | null): Promise<FetcResponse<T>> => {
  return fetchWrapper<T>(url, 'POST', { token })
}
