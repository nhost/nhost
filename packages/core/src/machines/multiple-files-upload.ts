import { actions, ActorRefFrom, assign, createMachine, send, spawn } from 'xstate'

import { AuthInterpreter } from '../types'

import { createFileUploadMachine, INITIAL_FILE_CONTEXT } from './file-upload'

const { pure, sendParent } = actions

export type FileItemRef = ActorRefFrom<ReturnType<typeof createFileUploadMachine>>

type FilesListContext = {
  progress: number | null
  files: Array<FileItemRef>
  loaded: number
  total: number
}

type FilesListEvents =
  | { type: 'ADD'; files: File | File[] }
  | { type: 'UPLOAD'; bucket?: string }
  | { type: 'UPLOAD_PROGRESS'; additions: number }
  | { type: 'UPLOAD_DONE' }
  | { type: 'UPLOAD_ERROR' }
  | { type: 'CANCEL' }
  | { type: 'REMOVE' }
  | { type: 'CLEAR' }

export const createMultipleFilesUploadMachine = (params: {
  url: string
  auth: AuthInterpreter
}) => {
  return createMachine(
    {
      id: 'files-list',
      schema: {
        context: {} as FilesListContext,
        events: {} as FilesListEvents
      },
      tsTypes: {} as import('./multiple-files-upload.typegen').Typegen0,
      context: {
        progress: null,
        files: [],
        loaded: 0,
        total: 0
      },
      initial: 'idle',
      on: {
        UPLOAD: { cond: 'hasFileToDownload', target: 'uploading' },
        ADD: { actions: 'addItem' },
        REMOVE: { actions: 'removeItem' }
      },
      states: {
        idle: {
          entry: ['resetProgress'],
          on: {
            CLEAR: { actions: 'clearList', target: 'idle' }
          }
        },
        uploading: {
          entry: ['upload', 'startProgress'],
          on: {
            UPLOAD_PROGRESS: { actions: ['incrementProgress'] },
            UPLOAD_DONE: [
              { cond: 'isAllUploaded', target: 'uploaded' },
              { cond: 'isAllUploadedOrError', target: 'error' }
            ],
            UPLOAD_ERROR: 'error',
            CANCEL: { actions: 'cancel', target: 'idle' }
          }
        },
        uploaded: {
          entry: 'setUploaded',
          on: {
            CLEAR: { actions: 'clearList', target: 'idle' }
          }
        },
        error: {
          on: {
            CLEAR: { actions: 'clearList', target: 'idle' }
          }
        }
      }
    },
    {
      guards: {
        hasFileToDownload: (context) =>
          context.files.some((ref) => ref.getSnapshot()!.matches('idle')),
        isAllUploaded: (context) =>
          context.files.every((item) => item.getSnapshot()?.matches('uploaded')),
        isAllUploadedOrError: (context) =>
          context.files.every((item) => {
            const snap = item.getSnapshot()
            return snap?.matches('error') || snap?.matches('uploaded')
          })
      },

      actions: {
        incrementProgress: assign((context, event) => {
          const total = context.total
          const loaded = context.loaded + event.additions
          const progress = Math.round((loaded * 100) / total)
          return { ...context, loaded, progress, total }
        }),
        setUploaded: assign({
          progress: (_) => 100,
          loaded: ({ files }) =>
            files
              .map((ref) => ref.getSnapshot()!)
              .filter((snap) => snap.matches('uploaded'))
              .reduce((agg, curr) => agg + curr.context.file?.size!, 0)
        }),
        startProgress: assign({
          progress: (_) => 0,
          loaded: (_) => 0,
          total: ({ files }) =>
            files
              .map((ref) => ref.getSnapshot()!)
              .filter((snap) => !snap.matches('uploaded'))
              .reduce((agg, curr) => agg + curr.context.file?.size!, 0)
        }),
        resetProgress: assign({
          progress: (_) => null,
          loaded: (_) => 0,
          total: ({ files }) =>
            files
              .map((ref) => ref.getSnapshot()!)
              .filter((snap) => !snap.matches('uploaded'))
              .reduce((agg, curr) => agg + curr.context.file?.size!, 0)
        }),
        addItem: assign((context, { files }) => {
          const additions = Array.isArray(files) ? files : [files]
          const total = context.total + additions.reduce((agg, curr) => agg + curr.size, 0)
          const progress = Math.round((context.loaded * 100) / total)
          return {
            files: [
              ...context.files,
              ...additions.map((file) =>
                spawn(
                  createFileUploadMachine(params)
                    .withConfig({
                      actions: {
                        sendProgress: sendParent((_, { additions }) => ({
                          type: 'UPLOAD_PROGRESS',
                          additions
                        })),
                        sendDone: sendParent('UPLOAD_DONE'),
                        sendError: sendParent('UPLOAD_ERROR'),
                        sendDestroy: sendParent('REMOVE')
                      }
                    })
                    .withContext({ ...INITIAL_FILE_CONTEXT, file }),
                  { sync: true }
                )
              )
            ],
            total,
            loaded: context.loaded,
            progress
          }
        }),
        removeItem: assign({
          files: (context) =>
            context.files.filter((ref) => {
              const stopped = ref.getSnapshot()?.matches('stopped')
              if (stopped) {
                ref.stop?.()
              }
              return !stopped
            })
        }),
        clearList: pure((context) =>
          context.files.map((ref) => send({ type: 'DESTROY' }, { to: ref.id }))
        ),
        upload: pure((context, { bucket }) =>
          context.files.map((ref) => send({ type: 'UPLOAD', bucket }, { to: ref.id }))
        ),
        cancel: pure((context) =>
          context.files.map((ref) => send({ type: 'CANCEL' }, { to: ref.id }))
        )
      }
    }
  )
}
