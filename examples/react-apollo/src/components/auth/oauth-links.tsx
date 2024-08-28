import { SiApple, SiGithub, SiGoogle, SiLinkedin } from '@icons-pack/react-simple-icons'
import { Link } from 'react-router-dom'
import { useProviderLink } from '@nhost/react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export default function OAuthLinks() {
  const { github, apple, google, linkedin } = useProviderLink({
    redirectTo: window.location.origin
  })

  return (
    <div className="flex flex-col w-full max-w-md space-y-2">
      <Link
        to={github}
        className={cn(
          buttonVariants({ variant: 'link' }),
          'bg-[#131111] text-white hover:opacity-90 hover:no-underline'
        )}
      >
        <SiGithub className="w-4 h-4" />
        <span className="flex-1 text-center">Continue with Github</span>
      </Link>
      <Link
        to={google}
        className={cn(
          buttonVariants({ variant: 'link' }),
          'bg-[#DE5246] text-white hover:opacity-90 hover:no-underline'
        )}
      >
        <SiGoogle className="w-4 h-4" />
        <span className="flex-1 text-center">Continue with Google</span>
      </Link>

      <Link
        to={apple}
        className={cn(
          buttonVariants({ variant: 'link' }),
          'bg-[#131111] text-white hover:opacity-90 hover:no-underline'
        )}
      >
        <SiApple className="w-4 h-4" />
        <span className="flex-1 text-center">Continue with Apple</span>
      </Link>

      <Link
        to={linkedin}
        className={cn(
          buttonVariants({ variant: 'link' }),
          'bg-[#0073B1] text-white hover:opacity-90 hover:no-underline'
        )}
      >
        <SiLinkedin className="w-4 h-4" />
        <span className="flex-1 text-center">Continue with LinkedIn</span>
      </Link>
    </div>
  )
}
