import { getNhost } from '@utils/nhost'

export default async function Echo() {
  const nhost = await getNhost()

  const { res } = await nhost.functions.call<{
    headers: unknown
    query: unknown
    node: string
  }>('echo')

  return (
    <div>
      <pre className="overflow-auto">{JSON.stringify(res?.data.headers, null, 2)}</pre>
    </div>
  )
}
