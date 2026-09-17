'use client';

import { LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/lib/nhost/actions';

export function initials(displayName?: string | null, email?: string): string {
  const source = displayName?.trim() || email || '';
  const words = source.split(/[\s@._-]+/).filter(Boolean);

  if (words.length === 0) {
    return '?';
  }

  const letters =
    words.length > 1
      ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`
      : (words[0]?.slice(0, 2) ?? '');

  return letters.toUpperCase();
}

export function UserMenu({
  email,
  displayName,
  avatarUrl,
}: {
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const router = useRouter();

  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
    } catch (err) {
      console.error('Error signing out:', err);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open the account menu"
        className="rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-8 border">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="font-medium text-xs">
            {initials(displayName, email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          {displayName ? <span>{displayName}</span> : null}
          <span className="font-normal text-muted-foreground text-xs">
            {email}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User aria-hidden />
            Profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
