import NhostLogo from '@/components/NhostLogo';
import ReactLogo from '@/components/ReactLogo';
import { cn } from '@/lib/utils';

const logos = [
  {
    href: 'https://nhost.io',
    name: 'Nhost',
    Logo: NhostLogo,
  },
  {
    href: 'https://react.dev',
    name: 'React',
    Logo: ReactLogo,
  },
] as const;

function LogoLink({
  logo: { href, name, Logo },
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
      <Logo className="size-16" />
      <span className="sr-only">{name}</span>
    </a>
  );
}

/**
 * The home page's title, with each mark centred over its own name and linking
 * to its project.
 */
export default function StackTitle() {
  const [backend, framework] = logos;

  return (
    <div className="grid w-fit grid-cols-[auto_auto_auto] items-end gap-x-3 gap-y-7">
      <LogoLink logo={backend} className="col-start-1" />
      <LogoLink logo={framework} className="col-start-3" />
      <h1 className="col-span-3 row-start-2 grid grid-cols-subgrid font-semibold text-4xl tracking-tight">
        <span>{backend.name}</span> <span>+</span> <span>{framework.name}</span>
      </h1>
    </div>
  );
}
