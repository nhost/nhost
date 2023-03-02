import fetch from 'isomorphic-unfetch'
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
      const error = await result.json()
      return Promise.reject<FetcResponse<T>>({ error })
    }
    try {
      const data = await result.json()
      return { data, error: null }
    } catch {
      console.warn(`Unexpected response: can't parse the response of the server at ${url}`)
      return { data: 'OK' as any, error: null }
    }
  } catch (e) {
    const error = {
      message: 'Network Error',
      status: NETWORK_ERROR_CODE,
      error: 'network'
    }
    return Promise.reject<FetcResponse<T>>({ error })
  }
}

export const postFetch = async <T>(
  url: string,
  body: any,
  token?: string | null
): Promise<FetcResponse<T>> => fetchWrapper<T>(url, 'POST', { token, body })

export const getFetch = <T>(url: string, token?: string | null): Promise<FetcResponse<T>> =>
  fetchWrapper<T>(url, 'GET', { token })
