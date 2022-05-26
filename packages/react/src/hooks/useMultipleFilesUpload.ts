import { createFilesListMachine, FileItemRef } from '@nhost/core'
import { useActor, useInterpret, useSelector } from '@xstate/react'
import { useAuthInterpreter, useNhostBackendUrl } from './common'
import { useMemo } from 'react'

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

  const progress = useSelector(service, (state) => state.context.progress)
  const isUploaded = useSelector(service, (state) => state.matches('uploaded'))
  const isUploading = useSelector(service, (state) => state.matches('uploading'))
  const add = (files: File | File[]) => {
    service.send('ADD', { files })
  }
  const upload = (options: UploadMultipleFilesActionParams = { bucket: 'default' }) => {
    const { bucket } = options
    service.send('UPLOAD', { bucket })
  }

  const list = useSelector(service, (state) => state.context.files)
  return { upload, add, progress, isUploaded, isUploading, list }
}

export const useFilesListItem = (ref: FileItemRef) => useActor(ref)
