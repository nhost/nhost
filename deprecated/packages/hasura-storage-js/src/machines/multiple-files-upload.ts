import { actions, ActorRefFrom, assign, createMachine, send, spawn } from 'xstate'

import { FileUploadConfig } from '../utils'

import { createFileUploadMachine, FileUploadMachine, INITIAL_FILE_CONTEXT } from './file-upload'

const { pure, sendParent } = actions

export type FileItemRef = ActorRefFrom<FileUploadMachine>

export type AnyFileList = File | File[] | FileList

export type MultipleFilesUploadContext = {
  progress: number | null
  files: FileItemRef[]
  loaded: number
  total: number
}

export type MultipleFilesUploadEvents =
  | { type: 'ADD'; files: AnyFileList; bucketId?: string }
  | ({
      type: 'UPLOAD'
      files?: AnyFileList
      bucketId?: string
    } & FileUploadConfig)
  | { type: 'UPLOAD_PROGRESS'; additions: number }
  | { type: 'UPLOAD_DONE' }
  | { type: 'UPLOAD_ERROR' }
  | { type: 'CANCEL' }
  | { type: 'REMOVE' }
  | { type: 'CLEAR' }

export type MultipleFilesUploadMachine = ReturnType<typeof createMultipleFilesUploadMachine>

export const createMultipleFilesUploadMachine = () => {
  return createMachine(
    {
      id: 'files-list',
      schema: {
        context: {} as MultipleFilesUploadContext,
        events: {} as MultipleFilesUploadEvents
      },
      tsTypes: {} as import('./multiple-files-upload.typegen').Typegen0,
      predictableActionArguments: true,
      context: {
        progress: null,
        files: [],
        loaded: 0,
        total: 0
      },
      initial: 'idle',
      on: {
        UPLOAD: { cond: 'hasFileToDownload', actions: 'addItem', target: 'uploading' },
        ADD: { actions: 'addItem' },
        REMOVE: { actions: 'removeItem' }
      },
      states: {
        idle: {
          entry: ['resetProgress', 'resetLoaded', 'resetTotal'],
          on: {
            CLEAR: { actions: 'clearList', target: 'idle' }
          }
        },
        uploading: {
          entry: ['upload', 'startProgress', 'resetLoaded', 'resetTotal'],
          on: {
            UPLOAD_PROGRESS: { actions: ['incrementProgress'] },
            UPLOAD_DONE: [
              { cond: 'isAllUploaded', target: 'uploaded' },
              { cond: 'isAllUploadedOrError', target: 'error' }
            ],
            UPLOAD_ERROR: [
              { cond: 'isAllUploaded', target: 'uploaded' },
              { cond: 'isAllUploadedOrError', target: 'error' }
            ],
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
        hasFileToDownload: (context, event) =>
          context.files.some((ref) => ref.getSnapshot()!.matches('idle')) || !!event.files,
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
          const loaded: number = context.loaded + event.additions
          const progress = Math.round((loaded * 100) / context.total)
          return { ...context, loaded, progress }
        }),
        setUploaded: assign({
          progress: (_) => 100,
          loaded: ({ files }) =>
            files
              .map((ref) => ref.getSnapshot()!)
              .filter((snap) => snap.matches('uploaded'))
              .reduce((agg, curr) => agg + curr.context.file?.size!, 0)
        }),
        resetTotal: assign({
          total: ({ files }) =>
            files
              .map((ref) => ref.getSnapshot()!)
              .filter((snap) => !snap.matches('uploaded'))
              .reduce((agg, curr) => agg + curr.context.file?.size!, 0)
        }),
        resetLoaded: assign({ loaded: (_) => 0 }),
        startProgress: assign({ progress: (_) => 0 }),
        resetProgress: assign({ progress: (_) => null }),
        addItem: assign((context, { files, bucketId }) => {
          const additions = files
            ? Array.isArray(files)
              ? files // File[]
              : 'item' in files // FileList
              ? Array.from(files)
              : [files] // File
            : [] // No file
          const total = context.total + additions.reduce((agg, curr) => agg + curr.size, 0)
          const progress = Math.round((context.loaded * 100) / total)
          return {
            files: [
              ...context.files,
              ...additions.map((file) =>
                spawn(
                  createFileUploadMachine()
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
                    .withContext({ ...INITIAL_FILE_CONTEXT, file, bucketId }),
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
        upload: pure((context, event) => context.files.map((ref) => send(event, { to: ref.id }))),
        cancel: pure((context) =>
          context.files.map((ref) => send({ type: 'CANCEL' }, { to: ref.id }))
        )
      }
    }
  )
}
