import NextjsLogo from '@/components/NextjsLogo';
import NhostLogo from '@/components/NhostLogo';
import { cn } from '@/lib/utils';

const logos = [
  {
    href: 'https://nhost.io',
    name: 'Nhost',
    Logo: NhostLogo,
    // Two shadows, a tight one under the wide one: the mark is thin lines,
    // and a single wide shadow barely showed around them.
    glow: 'hover:[filter:drop-shadow(0_0_0.4rem_#3d7fff)_drop-shadow(0_0_1.5rem_#3d7fff)]',
  },
  {
    href: 'https://nextjs.org',
    name: 'Next.js',
    Logo: NextjsLogo,
    glow: 'hover:drop-shadow-[0_0_1.5rem_#ffffff88]',
  },
] as const;

function LogoLink({
  logo: { href, name, Logo, glow },
  className,
}: {
  logo: (typeof logos)[number];
  className: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'justify-self-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Logo className={cn('size-16 transition-[filter] duration-300', glow)} />
      <span className="sr-only">{name}</span>
    </a>
  );
}

/**
 * The home page's title, with each mark centred over its own name and linking
 * to its project, glowing in its own colour on hover the way the Vite starters
 * do.
 */
export default function StackTitle() {
  const [backend, framework] = logos;

  return (
    <div className="grid w-fit grid-cols-[auto_auto_auto] items-end gap-x-3 gap-y-7">
      {/* Over the first and last columns; the middle one is the +. */}
      <LogoLink logo={backend} className="col-start-1" />
      <LogoLink logo={framework} className="col-start-3" />
      <h1 className="col-span-3 row-start-2 grid grid-cols-subgrid font-semibold text-4xl tracking-tight">
        <span>{backend.name}</span> <span>+</span> <span>{framework.name}</span>
      </h1>
    </div>
  );
}
