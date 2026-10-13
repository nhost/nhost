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
 */
export default function OAuthButtons({ links }: { links: OAuthLink[] }) {
  return (
    <div className="flex flex-col gap-2">
      {links.map((link) => (
        <Button key={link.id} asChild variant="outline" className="w-full">
          <a href={link.href}>{link.label}</a>
        </Button>
      ))}
    </div>
  );
}
