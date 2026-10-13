import { redirect } from 'next/navigation';
import AvatarForm from '@/app/account/AvatarForm';
import ChangeEmailForm from '@/app/account/ChangeEmailForm';
import ChangePasswordForm from '@/app/account/ChangePasswordForm';
import DisplayNameForm from '@/app/account/DisplayNameForm';
import ProfileSummary from '@/app/account/ProfileSummary';
import SignInMethodLinks from '@/app/account/SignInMethodLinks';
import SignOutCard from '@/app/account/SignOutCard';
import { signInHref } from '@/app/signin/destination';
import { localMailboxURL } from '@/lib/nhost/env';
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
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <ProfileSummary user={user} />
      <DisplayNameForm displayName={user.displayName} />
      <AvatarForm avatarUrl={user.avatarUrl} />
      <ChangeEmailForm
        email={user.email}
        verified={user.emailVerified}
        mailboxURL={localMailboxURL()}
      />
      <ChangePasswordForm />
      <SignInMethodLinks />
      <SignOutCard />
    </div>
  );
}
