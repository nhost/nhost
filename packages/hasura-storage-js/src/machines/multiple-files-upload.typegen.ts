// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    addItem: 'UPLOAD' | 'ADD'
    removeItem: 'REMOVE'
    clearList: 'CLEAR'
    incrementProgress: 'UPLOAD_PROGRESS'
    cancel: 'CANCEL'
    resetProgress: 'CLEAR' | 'CANCEL'
    resetLoaded: 'CLEAR' | 'CANCEL' | 'UPLOAD'
    resetTotal: 'CLEAR' | 'CANCEL' | 'UPLOAD'
    upload: 'UPLOAD'
    startProgress: 'UPLOAD'
    setUploaded: 'UPLOAD_DONE' | 'UPLOAD_ERROR'
  }
  internalEvents: {
    'xstate.init': { type: 'xstate.init' }
  }
  invokeSrcNameMap: {}
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {}
  eventsCausingGuards: {
    hasFileToDownload: 'UPLOAD'
    isAllUploaded: 'UPLOAD_DONE' | 'UPLOAD_ERROR'
    isAllUploadedOrError: 'UPLOAD_DONE' | 'UPLOAD_ERROR'
  }
  eventsCausingDelays: {}
  matchesStates: 'idle' | 'uploading' | 'uploaded' | 'error'
  tags: never
}
