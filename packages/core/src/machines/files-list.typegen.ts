// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    add: 'ADD'
    remove: 'REMOVE'
    setUploadProgress: 'REMOVE' | 'UPLOAD_PROGRESS' | 'UPLOAD_DONE'
    clear: 'CLEAR'
    upload: 'UPLOAD'
    initProgress: 'UPLOAD'
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
  }
  eventsCausingDelays: {}
  matchesStates: 'idle' | 'uploading' | 'uploaded' | 'error'
  tags: never
}
