import fetch from 'cross-fetch'

export const callHasuraMetadataAPI = async <T = any>(body?: any) => {
  const res = await fetch(`${process.env.NHOST_BACKEND_URL}/v1/metadata`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': process.env.NHOST_ADMIN_SECRET!
    },
    body: JSON.stringify(body)
  })
  if (res.status >= 400) {
    throw new Error('Bad response from server')
  }
  return res.json() as Promise<T>
}
