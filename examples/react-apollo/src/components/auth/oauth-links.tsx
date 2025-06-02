import { SiApple, SiGithub, SiGoogle, SiLinkedin, SiDiscord, SiSpotify, SiTwitch, SiGitlab, SiBitbucket, SiMicrosoftazure } from '@icons-pack/react-simple-icons'
import { Link } from 'react-router-dom'
import { useProviderLink } from '@nhost/react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { WorkOSIcon } from '../ui/workosicon'

export default function OAuthLinks() {
  const { github, apple, google, linkedin, discord, spotify, twitch, gitlab, bitbucket, workos, azuread } = useProviderLink({
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

      <Link
        to={discord}
        className={cn(
          buttonVariants({ variant: 'link' }),
          'bg-[#7289da] text-white hover:opacity-90 hover:no-underline'
        )}
      >
        <SiDiscord className="w-4 h-4" />
        <span className="flex-1 text-center">Continue with Discord</span>
      </Link>

      <Link
        to={spotify}
        className={cn(
          buttonVariants({ variant: 'link' }),
          'bg-[#1DB954] text-white hover:opacity-90 hover:no-underline'
        )}
      >
        <SiSpotify className="w-4 h-4" />
        <span className="flex-1 text-center">Continue with Spotify</span>
      </Link>

      <Link
        to={twitch}
        className={cn(
          buttonVariants({ variant: 'link' }),
          'bg-[#9146ff] text-white hover:opacity-90 hover:no-underline'
        )}
      >
        <SiTwitch className="w-4 h-4" />
        <span className="flex-1 text-center">Continue with Twitch</span>
      </Link>

      <Link
        to={gitlab}
        className={cn(
          buttonVariants({ variant: 'link' }),
          'bg-[#FCA326] text-white hover:opacity-90 hover:no-underline'
        )}
      >
        <SiGitlab className="w-4 h-4" />
        <span className="flex-1 text-center">Continue with Gitlab</span>
      </Link>

      <Link
        to={bitbucket}
        className={cn(
          buttonVariants({ variant: 'link' }),
          'bg-[#253858] text-white hover:opacity-90 hover:no-underline'
        )}
      >
        <SiBitbucket className="w-4 h-4" />
        <span className="flex-1 text-center">Continue with Bitbucket</span>
      </Link>

      <Link
        to={workos}
        className={cn(
          buttonVariants({ variant: 'link' }),
          'bg-[#4F46E5] text-white hover:opacity-90 hover:no-underline'
        )}
      >
        <WorkOSIcon />
        <span className="flex-1 text-center">Continue with WorkOS</span>
      </Link>

      <Link
        to={azuread}
        className={cn(
          buttonVariants({ variant: 'link' }),
          'bg-[#3CCBF4] text-white hover:opacity-90 hover:no-underline'
        )}
      >
        <SiMicrosoftazure className="w-4 h-4" />
        <span className="flex-1 text-center">Continue with Azure AD</span>
      </Link>

    </div>
  )
}
