// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  internalEvents: {
    'xstate.init': { type: 'xstate.init' }
  }
  invokeSrcNameMap: {}
  missingImplementations: {
    actions: never
    delays: never
    guards: never
    services: never
  }
  eventsCausingActions: {
    addItem: 'ADD' | 'UPLOAD'
    cancel: 'CANCEL'
    clearList: 'CLEAR'
    incrementProgress: 'UPLOAD_PROGRESS'
    removeItem: 'REMOVE'
    resetLoaded: 'CANCEL' | 'CLEAR' | 'UPLOAD' | 'xstate.init'
    resetProgress: 'CANCEL' | 'CLEAR' | 'UPLOAD' | 'xstate.init'
    resetTotal: 'CANCEL' | 'CLEAR' | 'UPLOAD' | 'xstate.init'
    setUploaded: 'UPLOAD_DONE' | 'UPLOAD_ERROR'
    startProgress: 'UPLOAD'
    upload: 'UPLOAD'
  }
  eventsCausingDelays: {}
  eventsCausingGuards: {
    hasFileToDownload: 'UPLOAD'
    isAllUploaded: 'UPLOAD_DONE' | 'UPLOAD_ERROR'
    isAllUploadedOrError: 'UPLOAD_DONE' | 'UPLOAD_ERROR'
  }
  eventsCausingServices: {}
  matchesStates: 'error' | 'idle' | 'uploaded' | 'uploading'
  tags: never
}
