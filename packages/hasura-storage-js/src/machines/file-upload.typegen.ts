// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
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
  eventsCausingActions: {
    addFile: 'ADD'
    incrementProgress: 'UPLOAD_PROGRESS'
    resetProgress: 'UPLOAD'
    sendDestroy: 'DESTROY'
    sendDone: 'UPLOAD_DONE'
    sendError: 'UPLOAD_ERROR'
    sendProgress: 'UPLOAD_PROGRESS'
    setError: 'UPLOAD_ERROR'
    setFileMetadata: 'UPLOAD_DONE'
  }
  eventsCausingServices: {
    uploadFile: 'UPLOAD'
  }
  eventsCausingGuards: {
    hasFile: 'UPLOAD'
  }
  eventsCausingDelays: {}
  matchesStates: 'error' | 'idle' | 'stopped' | 'uploaded' | 'uploading'
  tags: never
}
