import { useMemo } from 'react'

import { createFilesListMachine } from '@nhost/core'
import { useInterpret, useSelector } from '@xstate/react'
import { useNhostBackendUrl } from './useNhostBackendUrl'
import { useAuthInterpreter } from './useAuthInterpreter'
type UploadMultipleFilesActionParams = {
  bucket?: string
}

export const useMultipleFilesUpload = () => {
  const url = useNhostBackendUrl()
  const authInterpreter = useAuthInterpreter()
  const machine = useMemo(
    () => createFilesListMachine(url, authInterpreter),
    [authInterpreter, url]
  )
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
