import { useState } from 'react'

export function getPageProps({ url, name, path, initialState, isClient } = {}) {
  if (initialState.name === name) {
    return initialState
  }

  const baseUrl = isClient ? '' : url.origin

  // Get our page props from our custom API:
  const promise = fetch(
    `${baseUrl}/api/getProps?path=${encodeURIComponent(
      path
    )}&name=${name}&client=${typeof window !== 'undefined'}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  ).then((res) => res.json())

  if (import.meta.env.SSR) {
    // Server needs to await for this before rendering
    return promise
  }

  // Client can set props asynchronously using hooks
  const [pageProps, setPageProps] = useState()

  promise.then(setPageProps)

  return pageProps
}
