import fetchPonyfill from 'fetch-ponyfill'
import { NETWORK_ERROR_CODE } from '../errors'
import { NullableErrorResponse } from '../types'

declare const EdgeRuntime: any

interface FetchResponse<T> extends NullableErrorResponse {
  data: T
}

let fetch = globalThis.fetch

if (typeof EdgeRuntime !== 'string') {
  fetch = fetchPonyfill().fetch
}

const fetchWrapper = async <T>(
  url: string,
  method: 'GET' | 'POST',
  {
    token,
    body,
    extraHeaders
  }: { token?: string | null; body?: any; extraHeaders?: HeadersInit } = {}
): Promise<FetchResponse<T>> => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: '*/*'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const mergedHeaders = { ...headers, ...extraHeaders }

  const options: RequestInit = {
    method,
    headers: mergedHeaders
  }
  if (body) {
    options.body = JSON.stringify(body)
  }
  try {
    const result = await fetch(url, options)
    if (!result.ok) {
      const error = await result.json()
      return Promise.reject<FetchResponse<T>>({ error })
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
    return Promise.reject<FetchResponse<T>>({ error })
  }
}

export const postFetch = async <T>(
  url: string,
  body: any,
  token?: string | null,
  extraHeaders?: HeadersInit
): Promise<FetchResponse<T>> => fetchWrapper<T>(url, 'POST', { token, body, extraHeaders })

export const getFetch = <T>(url: string, token?: string | null): Promise<FetchResponse<T>> =>
  fetchWrapper<T>(url, 'GET', { token })
