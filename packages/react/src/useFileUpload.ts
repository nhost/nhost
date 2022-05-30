import { useMemo } from 'react'
import { InterpreterFrom } from 'xstate'

import { createFileUploadMachine, FileItemRef } from '@nhost/core'
import { useInterpret, useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'
import { useNhostBackendUrl } from './useNhostBackendUrl'

export const useFileUploadFromRef = (
  ref: FileItemRef | InterpreterFrom<ReturnType<typeof createFileUploadMachine>>
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
  const id = useSelector(ref, (state) => state.context.id)
  const bucket = useSelector(ref, (state) => state.context.bucket)
  const name = useSelector(ref, (state) => state.context.file?.name)

  //   ? Implement here or in another hook ?
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
    isUploaded,
    isUploading,
    isError,
    progress,
    id,
    bucket,
    name
  }
}

export const useFileUpload = () => {
  const url = useNhostBackendUrl()
  const auth = useAuthInterpreter()
  const machine = useMemo(() => createFileUploadMachine({ url, auth }), [url, auth])
  const service = useInterpret(machine, { devTools: false })

  return useFileUploadFromRef(service)
}
