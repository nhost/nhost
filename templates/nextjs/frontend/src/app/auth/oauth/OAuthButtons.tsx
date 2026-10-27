import ProviderIcon from '@/app/auth/oauth/ProviderIcon';
import LastUsedBadge from '@/components/LastUsedBadge';
import { Button } from '@/components/ui/button';

export type OAuthLink = {
  id: string;
  label: string;
  href: string;
  lastUsed?: boolean;
};

/** One button per provider. */
export default function OAuthButtons({ links }: { links: OAuthLink[] }) {
  return (
    <div className="flex flex-col gap-3">
      {links.map((link) => (
        <Button
          key={link.id}
          asChild
          variant="outline"
          className="relative w-full bg-transparent shadow-none dark:border-border dark:bg-transparent dark:hover:bg-accent"
        >
          {/* The button sizes and spaces the mark itself: its own rules give
              any svg inside it size-4 and a gap from the text. */}
          <a href={link.href}>
            <ProviderIcon id={link.id} />
            {link.label}
            {link.lastUsed ? <LastUsedBadge /> : null}
          </a>
        </Button>
      ))}
    </div>
  );
}
