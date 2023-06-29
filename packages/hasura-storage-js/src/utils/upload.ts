import fetchPonyfill from 'fetch-ponyfill'
import FormData from 'form-data'
import { StorageErrorPayload, StorageUploadResponse } from './types'

/** Convert any string into ISO-8859-1 */
export const toIso88591 = (fileName: string) => {
  try {
    btoa(fileName)
    return fileName
  } catch {
    return encodeURIComponent(fileName)
  }
}

const { fetch } = fetchPonyfill()

export const fetchUpload = async (
  backendUrl: string,
  data: FormData,
  {
    accessToken,
    name,
    fileId,
    bucketId,
    adminSecret,
    onUploadProgress,
    headers: initialHeaders = {}
  }: {
    accessToken?: string
    name?: string
    fileId?: string
    bucketId?: string
    adminSecret?: string
    onUploadProgress?: (event: { total: number; loaded: number }) => void
    headers?: Record<string, string>
  } = {}
): Promise<StorageUploadResponse> => {
  const headers: HeadersInit = {
    ...initialHeaders
  }
  if (bucketId) {
    data.append('bucket-id', bucketId)
  }
  if (adminSecret) {
    headers['x-hasura-admin-secret'] = adminSecret
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const url = `${backendUrl}/files`
  if (typeof XMLHttpRequest === 'undefined') {
    // * Non-browser environment: XMLHttpRequest is not available
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: data as any // * https://github.com/form-data/form-data/issues/513
      })

      const responseData = await response.json()

      if (!response.ok) {
        const error: StorageErrorPayload = {
          status: response.status,
          message: responseData?.error?.message || response.statusText,
          // * errors from hasura-storage are not codified
          error: response.statusText
        }
        return { error, fileMetadata: null }
      }
      const fileMetadata = responseData
      return { fileMetadata, error: null }
    } catch (e) {
      const error: StorageErrorPayload = {
        status: 0,
        message: (e as Error).message,
        error: (e as Error).message
      }
      return { error, fileMetadata: null }
    }
  }

  // * Browser environment: XMLHttpRequest is available
  return new Promise((resolve) => {
    let xhr = new XMLHttpRequest()
    xhr.responseType = 'json'

    xhr.onload = () => {
      if (xhr.status < 200 && xhr.status >= 300) {
        return resolve({
          fileMetadata: null,
          error: { error: xhr.statusText, message: xhr.statusText, status: xhr.status }
        })
      }
      return resolve({ fileMetadata: xhr.response, error: null })
    }

    xhr.onerror = () => {
      // only triggers if the request couldn't be made at all e.g. network error
      return resolve({
        fileMetadata: null,
        error: { error: xhr.statusText, message: xhr.statusText, status: xhr.status }
      })
    }

    if (onUploadProgress) {
      xhr.upload.addEventListener('progress', onUploadProgress, false)
    }

    xhr.open('POST', url, true)

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })

    xhr.send(data as any) // * https://github.com/form-data/form-data/issues/513
  })
}
