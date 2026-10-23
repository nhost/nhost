import { redirect } from 'next/navigation';
import DeleteAccountCard from '@/app/account/DeleteAccountCard';
import ProfileSummary from '@/app/account/ProfileSummary';
import SignInSettings from '@/app/account/SignInSettings';
import SignOutCard from '@/app/account/SignOutCard';
import { signInHref } from '@/app/signin/destination';
import Code from '@/components/Code';
import { Card } from '@/components/ui/card';
import { getVerifiedUser } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

export default async function Account() {
  // The proxy only reads the session cookie, which anyone can write, so it
  // redirects the signed-out but proves nothing. This asks the auth service,
  // and what it answers is what the page shows.
  const user = await getVerifiedUser();

  if (!user) {
    redirect(signInHref('/account'));
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* One card, not one per section: these are all settings for the same
          account, and separate cards left a row of rounded corners down the
          page. The card's own padding and gap come off so each section sets
          its own, divide-y draws the rule between them, and overflow-hidden
          keeps the first and last section square inside the rounded edge. */}
      <Card className="gap-0 divide-y overflow-hidden py-0">
        <ProfileSummary user={user} />
        <SignInSettings user={user} />
        <SignOutCard />
        <DeleteAccountCard />
      </Card>

      <p className="mt-6 text-center text-muted-foreground text-sm">
        Edit this page in <Code>src/app/account/</Code>. Each sign-in setting
        lives with its method in <Code>src/app/auth/</Code>.
      </p>
    </div>
  );
}
