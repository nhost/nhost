import { redirect } from 'next/navigation';
import DeleteAccountSetting from '@/app/account/DeleteAccountSetting';
import ProfileSummary from '@/app/account/ProfileSummary';
import SessionsCard from '@/app/account/SessionsCard';
import SignInSettings from '@/app/account/SignInSettings';
import { signInHref } from '@/app/signin/destination';
import Code from '@/components/Code';
import { SettingsList } from '@/components/Setting';
import { Card } from '@/components/ui/card';
import { getVerifiedUser } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

export default async function Account() {
  // The proxy only reads the session cookie, which anyone can write, so it
  // redirects the signed-out but proves nothing.
  const user = await getVerifiedUser();

  if (!user) {
    redirect(signInHref('/account'));
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <ProfileSummary user={user} />
      <SignInSettings user={user} />
      <SessionsCard />
      {/* Untitled: the label says what the row is, and the dialog it opens
          spells out what the button does. */}
      <Card className="gap-0 py-0">
        <SettingsList>
          <DeleteAccountSetting />
        </SettingsList>
      </Card>

      <p className="mt-2 text-center text-muted-foreground text-sm">
        Edit this page in <Code>src/app/account/</Code>.
      </p>
    </div>
  );
}
