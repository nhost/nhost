import { useMemo } from 'react'

import { createMultipleFilesUploadMachine } from '@nhost/core'
import { useInterpret, useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'
import { useNhostBackendUrl } from './useNhostBackendUrl'
type UploadMultipleFilesActionParams = {
  bucket?: string
}

export const useMultipleFilesUpload = () => {
  const url = useNhostBackendUrl()
  const auth = useAuthInterpreter()
  const machine = useMemo(() => createMultipleFilesUploadMachine({ url, auth }), [url, auth])
  const service = useInterpret(machine, { devTools: true })

  const add = (files: File | File[]) => {
    service.send('ADD', { files })
  }

  const upload = (options: UploadMultipleFilesActionParams = { bucket: 'default' }) => {
    const { bucket } = options
    service.send('UPLOAD', { bucket })
  }

  const cancel = () => {
    service.send('CANCEL')
  }

  const clear = () => {
    service.send('CLEAR')
  }

  const isUploading = useSelector(service, (state) => state.matches('uploading'))
  const isUploaded = useSelector(service, (state) => state.matches('uploaded'))
  const hasError = useSelector(service, (state) => state.matches('error'))

  const progress = useSelector(service, (state) => state.context.progress)
  const list = useSelector(service, (state) => state.context.files)

  return { upload, add, clear, progress, isUploaded, isUploading, list, hasError, cancel }
}
