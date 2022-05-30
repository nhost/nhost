// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    addItem: 'ADD'
    removeItem: 'REMOVE'
    clearList: 'CLEAR'
    incrementProgress: 'UPLOAD_PROGRESS'
    cancel: 'CANCEL'
    resetProgress: 'CLEAR' | 'CANCEL'
    upload: 'UPLOAD'
    startProgress: 'UPLOAD'
    setUploaded: 'UPLOAD_DONE'
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
    isAllUploaded: 'UPLOAD_DONE'
    isAllUploadedOrError: 'UPLOAD_DONE'
  }
  eventsCausingDelays: {}
  matchesStates: 'idle' | 'uploading' | 'uploaded' | 'error'
  tags: never
}
