import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { gql } from '@apollo/client'
import { SiGithub } from '@icons-pack/react-simple-icons'
import { useProviderLink } from '@nhost/react'
import { useAuthQuery } from '@nhost/react-apollo'
import { LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ConnectGithub() {
  const { github } = useProviderLink({
    connect: true,
    redirectTo: `${window.location.origin}/profile`
  })

  const { data, loading } = useAuthQuery<{
    authUserProviders: {
      id: string
      providerId: string
    }[]
  }>(gql`
    query getAuthUserProviders {
      authUserProviders {
        id
        providerId
      }
    }
  `)

  const isGithubConnected = data?.authUserProviders?.some((item) => item.providerId === 'github')

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle>Connect with Github</CardTitle>
      </CardHeader>
      <CardContent>
        {!loading && isGithubConnected && (
          <div className="flex flex-row items-center gap-2 w-fit">
            <SiGithub className="w-4 h-4" />
            <span className="flex-1 text-center">Github connected</span>
          </div>
        )}

        {!loading && !isGithubConnected && (
          <Link
            to={github}
            className={cn(
              buttonVariants({ variant: 'link' }),
              'bg-[#131111] text-white hover:opacity-90 hover:no-underline gap-2'
            )}
          >
            <SiGithub className="w-4 h-4" />
            <span className="flex-1 text-center">Continue with Github</span>
          </Link>
        )}

        {loading && <LoaderCircle className="w-5 h-5 animate-spin-fast" />}
      </CardContent>
    </Card>
  )
}
