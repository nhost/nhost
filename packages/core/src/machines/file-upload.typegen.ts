// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    addFile: 'ADD'
    sendDestroy: 'DESTROY'
    setUploadProgress: 'UPLOAD_PROGRESS'
    sendProgress: 'UPLOAD_PROGRESS'
    resetProgress: 'UPLOAD'
    sendDone: 'UPLOAD_DONE'
    setMetadata: 'UPLOAD_DONE'
    sendError: 'UPLOAD_ERROR'
  }
  internalEvents: {
    'xstate.init': { type: 'xstate.init' }
  }
  invokeSrcNameMap: {
    uploadFile: 'done.invoke.(machine).uploading:invocation[0]'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    uploadFile: 'UPLOAD'
  }
  eventsCausingGuards: {
    hasFile: 'UPLOAD'
  }
  eventsCausingDelays: {}
  matchesStates: 'idle' | 'uploading' | 'uploaded' | 'error' | 'stopped'
  tags: never
}
