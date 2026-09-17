import { ProfileModal } from '@/app/@modal/(.)profile/ProfileModal';
import { ProfilePanel } from '@/app/profile/ProfilePanel';

export const dynamic = 'force-dynamic';

/**
 * `/profile` when you arrive from inside the app, which is how the account
 * menu gets there. The panel is still rendered on the server: it is passed
 * through the dialog as children rather than imported by it.
 */
export default function InterceptedProfile() {
  return (
    <ProfileModal>
      <ProfilePanel />
    </ProfileModal>
  );
}
