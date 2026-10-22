import ProviderIcon from '@/app/auth/oauth/ProviderIcon';
import { Button } from '@/components/ui/button';

export type OAuthLink = {
  id: string;
  label: string;
  href: string;
};

/**
 * One button per provider. Plain anchors rather than `next/link`: the href is
 * the auth service, another origin, and the whole point is to leave this app
 * for it.
 *
 * Drawn like the method links above them rather than as shadcn's outline
 * button, whose own fill and border would set them apart from the list.
 */
export default function OAuthButtons({ links }: { links: OAuthLink[] }) {
  return (
    <div className="flex flex-col gap-2">
      {links.map((link) => (
        <Button
          key={link.id}
          asChild
          variant="outline"
          className="w-full bg-transparent shadow-none dark:border-border dark:bg-transparent dark:hover:bg-accent"
        >
          {/* The button sizes and spaces the mark itself: its own rules give
              any svg inside it size-4 and a gap from the text. */}
          <a href={link.href}>
            <ProviderIcon id={link.id} />
            {link.label}
          </a>
        </Button>
      ))}
    </div>
  );
}
