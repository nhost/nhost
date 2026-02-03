declare module 'virtual:starlight-openapi-schemas' {
  const StarlightOpenAPISchemas: Record<string, import('./libs/schema').Schema>

  export default StarlightOpenAPISchemas
}

declare module 'virtual:starlight-openapi-context' {
  const Context: {
    trailingSlash: import('astro').AstroConfig['trailingSlash']
  }

  export default Context
}
