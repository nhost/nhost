'use client';

import { LogOut, User } from 'lucide-react';
import Link from 'next/link';
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

/**
 * The single character an avatar falls back to when there is no image.
 *
 * Spread rather than indexed, so a name starting with an emoji or any other
 * astral character yields that character instead of half of its surrogate
 * pair. Falls back to the email, which every account has.
 */
export function initial(displayName?: string | null, email?: string): string {
  const [first] = [...(displayName?.trim() || email || '')];

  return first ? first.toUpperCase() : '?';
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
  // Leaves the same way signing in arrives: a full document load, so nothing
  // rendered against the old session survives in the client router's cache.
  const handleSignOut = async (): Promise<void> => {
    try {
      await signOut();
    } catch (err) {
      console.error('Error signing out:', err);
      return;
    }

    window.location.replace('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open the account menu"
        className="cursor-pointer rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-8 border">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="font-medium text-xs">
            {initial(displayName, email)}
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
