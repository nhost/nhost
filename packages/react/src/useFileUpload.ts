import { useMemo } from 'react'

import { createFileMachine } from '@nhost/core'
import { useInterpret, useSelector } from '@xstate/react'
import { useNhostBackendUrl } from './useNhostBackendUrl'
import { useAuthInterpreter } from './useAuthInterpreter'

export const useFileUpload = () => {
  const url = useNhostBackendUrl()
  const authInterpreter = useAuthInterpreter()
  const machine = useMemo(() => createFileMachine(url, authInterpreter), [authInterpreter, url])
  const service = useInterpret(machine, { devTools: false })

  const progress = useSelector(service, (state) => state.context.progress)
  const add = (file: File) => {
    service.send('ADD', { file })
  }
  const upload = (file?: File) => {
    service.send('UPLOAD', { file })
  }
  const isUploaded = useSelector(service, (state) => state.matches('uploaded'))
  const isUploading = useSelector(service, (state) => state.matches('uploading'))
  const isError = useSelector(service, (state) => state.matches('error'))
  //   ? Implement here ?
  //   const presign = () => {}
  //   const download = () => {}
  //   const publicUrl = 'todo'
  //   const presignedUrl = 'todo'
  //   const id = fileId || 'todo'

  return {
    add,
    upload,
    progress,
    isUploaded,
    isUploading,
    isError
  }
}
