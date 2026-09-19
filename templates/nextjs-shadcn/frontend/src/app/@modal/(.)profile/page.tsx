import { ProfilePanel } from '@/app/profile/ProfilePanel';

export const dynamic = 'force-dynamic';

/**
 * `/profile` when you arrive from inside the app, which is how the account
 * menu gets there. The Dialog chrome lives in the sibling `layout.tsx`, above
 * this segment's error boundary, so `ProfilePanel` throwing degrades inside
 * the open dialog instead of taking it down.
 */
export default function InterceptedProfile() {
  return <ProfilePanel />;
}
