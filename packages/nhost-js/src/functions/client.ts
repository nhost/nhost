/**
 * Functions client for the Nhost JavaScript SDK.
 *
 * This module provides functionality for executing serverless function calls
 * against Nhost serverless functions.
 */

import { createEnhancedFetch, FetchError, type ChainFunction, type FetchResponse } from '../fetch'

/**
 * Functions client interface providing methods for executing serverless function calls
 */
export interface Client {
  baseURL: string

  /**
   * Execute a request to a serverless function
   * The response body will be automatically parsed based on the content type into the following types:
   *   - Object if the response is application/json
   *   - string text string if the response is text/*
   *   - Blob if the response is any other type
   *
   * @param path - The path to the serverless function
   * @param options - Additional fetch options to apply to the request
   * @returns Promise with the function response and metadata.    */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch<T = any>(path: string, options?: RequestInit): Promise<FetchResponse<T>>

  /**
   * Executes a POST request to a serverless function with a JSON body
   *
   * This is a convenience method assuming the request is a POST with JSON body
   * setting the `Content-Type` and 'Accept' headers to `application/json` and
   * automatically stringifying the body.
   *
   * For a more generic request, use the `fetch` method instead.
   *
   * @param path - The path to the serverless function
   * @param body - The JSON body to send in the request
   * @param options - Additional fetch options to apply to the request
   * @returns Promise with the function response and metadata
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<T = any>(path: string, body?: unknown, options?: RequestInit): Promise<FetchResponse<T>>
}

/**
 * Creates a Functions API client for interacting with serverless functions.
 *
 * This client provides methods for executing requests against serverless functions,
 * with support for middleware functions to handle authentication, error handling,
 * and other cross-cutting concerns.
 *
 * @param baseURL - Base URL for the functions endpoint
 * @param chainFunctions - Array of middleware functions for the fetch chain
 * @returns Functions client with fetch method
 */
export const createAPIClient = (baseURL: string, chainFunctions: ChainFunction[] = []): Client => {
  const enhancedFetch = createEnhancedFetch(chainFunctions)

  /**
   * Executes a request to a serverless function and processes the response
   *
   * @param path - The path to the serverless function
   * @param options - Additional fetch options to apply to the request
   * @returns Promise with the function response and metadata. Body will be either
   *   - JSON object if the response is application/json
       - text string if the response is text/*
       - Blob if the response is any other type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetch = async <T = any>(
    path: string,
    options?: RequestInit
  ): Promise<FetchResponse<T | string | Blob>> => {
    const resp = await enhancedFetch(`${baseURL}${path}`, options)

    let body: T | string | Blob
    // Process response based on content type
    if (resp.headers.get('content-type')?.includes('application/json')) {
      body = (await resp.json()) as T
    } else if (resp.headers.get('content-type')?.startsWith('text/')) {
      body = await resp.text()
    } else {
      body = await resp.blob()
    }

    // Throw error for non-OK responses
    if (!resp.ok) {
      throw new FetchError(body, resp.status, resp.headers)
    }

    return {
      status: resp.status,
      body,
      headers: resp.headers
    }
  }

  /**
   * Executes a POST request to a serverless function with a JSON body
   *
   * This is a convenience method assuming the request is a POST with JSON body
   * setting the `Content-Type` and 'Accept' headers to `application/json` and
   * automatically stringifying the body.
   *
   * For a more generic request, use the `fetch` method instead.
   *
   * @param path - The path to the serverless function
   * @param body - The JSON body to send in the request
   * @param options - Additional fetch options to apply to the request
   * @returns Promise with the function response and metadata
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post = async <T = any>(
    path: string,
    body?: unknown,
    options: RequestInit = {}
  ): Promise<FetchResponse<T | string | Blob>> => {
    // Ensure the method is POST and set the body
    const requestOptions: RequestInit = {
      ...options,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: body ? JSON.stringify(body) : undefined
    }

    return fetch<T>(path, requestOptions)
  }

  // Return client object with the fetch method
  return {
    baseURL,
    fetch,
    post
  } as Client
}
