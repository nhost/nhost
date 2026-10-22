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
];

/**
 * The two marks the home page opens with, each linking to its project and
 * glowing in its own colour on hover, the way the Vite starters do.
 *
 * Every Nhost starter has one: the Nhost mark first, then the framework's,
 * so a template for another framework swaps the second entry and keeps the
 * rest.
 */
export default function StackLogos() {
  return (
    <div className="flex items-center gap-4">
      {logos.map(({ href, name, Logo, glow }, index) => (
        <div key={href} className="flex items-center gap-4">
          {index > 0 ? (
            <span aria-hidden="true" className="text-2xl text-muted-foreground">
              +
            </span>
          ) : null}
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo
              className={cn('size-12 transition-[filter] duration-300', glow)}
            />
            <span className="sr-only">{name}</span>
          </a>
        </div>
      ))}
    </div>
  );
}
