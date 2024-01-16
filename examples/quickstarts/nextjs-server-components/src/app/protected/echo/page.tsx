import withAuth from '@utils/auth-guard'
import { getNhost } from '@utils/nhost'

type EchoResponse = {
  headers: Record<string, string>
}

const Echo = async () => {
  const nhost = await getNhost()
  const { res } = await nhost.functions.call<EchoResponse>('echo')

  return (
    <div>
      <pre className="overflow-auto">{JSON.stringify(res?.data.headers, null, 2)}</pre>
    </div>
  )
}

export default withAuth(Echo)
