'use client';

import { Globe, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { OwnAvatarImage } from '@/components/OwnAvatarImage';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  userId,
  email,
  displayName,
  avatarUrl,
  publicProfile,
}: {
  userId: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  publicProfile: boolean;
}) {
  const [signOutError, setSignOutError] = useState<string | undefined>();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Leaves the same way signing in arrives: a full document load, so nothing
  // rendered against the old session survives in the client router's cache.
  //
  // Keeps the dropdown open on failure (`event.preventDefault()`) so the error
  // below has somewhere to render; Radix would otherwise close it as soon as
  // the item is selected, taking any inline message with it.
  const handleSignOut = async (event: Event): Promise<void> => {
    event.preventDefault();
    setSignOutError(undefined);
    setIsSigningOut(true);
    try {
      const result = await signOut();
      if (result?.error) {
        setSignOutError(result.error);
        return;
      }

      window.location.replace('/');
    } catch (err) {
      console.error('Error signing out:', err);
      setSignOutError('The request did not reach the server. Try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open the account menu"
        className="cursor-pointer rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-8 border">
          <OwnAvatarImage userId={userId} avatarUrl={avatarUrl} />
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

        {/* Only once there is a page to see. While the profile is unpublished
            this link would lead to the same 404 a stranger gets, which is a
            confusing thing to find in your own account menu. */}
        {publicProfile ? (
          <DropdownMenuItem asChild>
            <Link href={`/u/${userId}`}>
              <Globe aria-hidden />
              See public profile
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onSelect={(event) => void handleSignOut(event)}
        >
          <LogOut aria-hidden />
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>

        {signOutError ? (
          <p role="alert" className="px-2 py-1.5 text-destructive text-xs">
            {signOutError}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
