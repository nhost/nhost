import { actions, ActorRefFrom, assign, createMachine, send, spawn } from 'xstate'

import { AuthInterpreter } from '../types'

import { createFileMachine, INITIAL_FILE_CONTEXT } from './file'

const { pure, sendParent } = actions

export type FileItemRef = ActorRefFrom<ReturnType<typeof createFileMachine>>

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

export const createFilesListMachine = (url: string, authInterpreter: AuthInterpreter) => {
  return createMachine(
    {
      id: 'files-list',
      schema: {
        context: {} as FilesListContext,
        events: {} as FilesListEvents
      },
      tsTypes: {} as import('./files-list.typegen').Typegen0,
      context: {
        progress: null,
        files: [],
        loaded: 0,
        total: 0
      },
      initial: 'idle',
      on: {
        UPLOAD: { cond: 'hasFileToDownload', target: 'uploading' },
        ADD: { actions: 'add' },
        REMOVE: { actions: 'remove' },
        CLEAR: { target: 'idle', actions: 'clear' }
      },
      states: {
        idle: {},
        uploading: {
          entry: ['upload', 'initProgress'],
          on: {
            UPLOAD_PROGRESS: { actions: ['setUploadProgress'] },
            UPLOAD_DONE: [
              { cond: 'isAllUploaded', target: 'uploaded' },
              { cond: 'isAllUploadedOrError', target: 'error' }
            ],
            UPLOAD_ERROR: 'error'
          }
        },
        uploaded: {},
        error: {}
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
        setUploadProgress: assign((context, event) => {
          const total = context.total
          const loaded = context.loaded + event.additions
          const progress = Math.round((loaded * 100) / total)
          return { ...context, loaded, progress, total }
        }),
        initProgress: assign({
          progress: (_) => 0,
          loaded: (_) => 0,
          total: ({ files }) =>
            files
              .map((ref) => ref.getSnapshot()!)
              .filter((snap) => snap.value !== 'uploaded')
              .reduce((agg, curr) => agg + curr.context.file?.size!, 0)
        }),
        add: assign((context, { files }) => {
          const additions = Array.isArray(files) ? files : [files]
          const total = context.total + additions.reduce((agg, curr) => agg + curr.size, 0)
          const progress = Math.round((context.loaded * 100) / total)
          return {
            files: [
              ...context.files,
              ...additions.map((file) =>
                spawn(
                  createFileMachine(url, authInterpreter)
                    .withConfig({
                      actions: {
                        sendProgress: sendParent('UPLOAD_PROGRESS'),
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
        remove: assign({
          files: (context) =>
            context.files.filter((ref) => {
              const stopped = ref.getSnapshot()?.matches('stopped')
              if (stopped) {
                ref.stop?.()
              }
              return !stopped
            })
        }),
        clear: pure((context) =>
          context.files.map((ref) => send({ type: 'DESTROY' }, { to: ref.id }))
        ),
        upload: pure((context, { bucket }) =>
          context.files.map((ref) => send({ type: 'UPLOAD', bucket }, { to: ref.id }))
        )
      }
    }
  )
}
