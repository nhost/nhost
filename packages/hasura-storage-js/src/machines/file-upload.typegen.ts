// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    sendDestroy: 'DESTROY'
    addFile: 'ADD'
    incrementProgress: 'UPLOAD_PROGRESS'
    sendProgress: 'UPLOAD_PROGRESS'
    resetProgress: 'UPLOAD'
    setFileMetadata: 'UPLOAD_DONE'
    sendDone: 'UPLOAD_DONE'
    setError: 'UPLOAD_ERROR'
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
