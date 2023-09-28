import { getNhost } from '@utils/nhost'
import { redirect } from 'next/navigation'

const withAuthAsync =
  <P extends {}>(Component: React.FunctionComponent<P>) =>
  async (props: P) => {
    const nhost = await getNhost()
    const session = nhost.auth.getSession()

    if (!session) {
      redirect('/auth/sign-in')
    }

    return <Component {...props} />
  }

export default withAuthAsync
