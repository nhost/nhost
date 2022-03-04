import { useState } from 'react'

interface FileResponse {
  id: string
  name: string
  size: number
  mimeType: string
  etag: string
  createdAt: string
  bucketId: string
}
type StorageUploadParams = {
  file: File
  id?: string
  name?: string
  bucketId?: string
}

// export const useFile = () => {
//   const getPublicUrl = (fileId) => {
//     return 'a string url'
//   }
//   const getPresignedUrl = (fileId) => {
//     return 'a string url'
//   }

//   // original name: 'delete' - but 'delete' is a reserved word
//   const remove = (fileId) => {}
// }

export const useFileUpload = (file: File) => {
  const upload = (param: StorageUploadParams) => {
    return null as unknown as FileResponse
  }
  const [progress, setProgress] = useState(0)
  const metadata = {}
  const isError = false
  const isSuccess = true
  const error = {}

  return {
    upload,
    progress,
    isError,
    isSuccess,
    error,
    metadata
  }
}

export const useFileInformation = (fileId: string) => {
  return {}
}

export const usePresignedUrl = (fileId: string) => {
  return 'a string'
}

export const useFile = (filedId: string) => {
  return {
    value: null,
    metadata: null
  }
}
