import { useMemo } from 'react'

import { createFileMachine, FileItemRef } from '@nhost/core'
import { useInterpret, useSelector } from '@xstate/react'
import { useNhostBackendUrl } from './useNhostBackendUrl'
import { useAuthInterpreter } from './useAuthInterpreter'
import { InterpreterFrom } from 'xstate'

export const useFileUploadFromRef = (
  ref: FileItemRef | InterpreterFrom<ReturnType<typeof createFileMachine>>
) => {
  const add = (file: File) => {
    ref.send({ type: 'ADD', file })
  }

  const upload = (file?: File) => {
    ref.send({ type: 'UPLOAD', file })
  }

  const cancel = () => {
    ref.send({ type: 'CANCEL' })
  }

  const destroy = () => {
    ref.send('DESTROY')
  }

  const isUploading = useSelector(ref, (state) => state.matches('uploading'))
  const isUploaded = useSelector(ref, (state) => state.matches('uploaded'))
  const isError = useSelector(ref, (state) => state.matches('error'))

  const progress = useSelector(ref, (state) => state.context.progress)
  const fileName = useSelector(ref, (state) => state.context.file?.name)

  //   ? Implement here ?
  //   const presign = () => {}
  //   const download = () => {}
  //   const publicUrl = 'todo'
  //   const presignedUrl = 'todo'
  //   const id = fileId || 'todo'

  return {
    add,
    upload,
    cancel,
    destroy,
    progress,
    isUploaded,
    isUploading,
    isError,
    fileName
  }
}

export const useFileUpload = () => {
  const url = useNhostBackendUrl()
  const authInterpreter = useAuthInterpreter()
  const machine = useMemo(() => createFileMachine(url, authInterpreter), [authInterpreter, url])
  const service = useInterpret(machine, { devTools: false })

  return useFileUploadFromRef(service)
}
