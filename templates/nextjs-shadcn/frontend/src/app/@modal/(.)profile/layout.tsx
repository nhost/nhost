import type { ReactNode } from 'react';
import { ProfileModal } from '@/app/@modal/(.)profile/ProfileModal';

/**
 * Split from `page.tsx` so the Dialog chrome renders above the error
 * boundary Next.js attaches to this segment: a load failure inside
 * `ProfilePanel` is caught by the sibling `error.tsx` and swaps only the
 * content, leaving the open dialog in place instead of falling through to
 * Next's bare crash page.
 */
export default function InterceptedProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ProfileModal>{children}</ProfileModal>;
}
