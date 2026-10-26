import { listSessions } from '@/app/account/actions';
import SessionList from '@/app/account/SessionList';
import { summarizeSessions } from '@/app/account/sessions';
import { SettingsList } from '@/components/Setting';
import { Card } from '@/components/ui/card';

/**
 * Where the account is signed in, each with a way to end it.
 *
 * Read when the page renders, like the passkeys: signing a session out
 * refreshes the page, which reads the list again.
 */
export default async function SessionsCard() {
  const { sessions, error } = await listSessions();

  return (
    <Card className="gap-0 py-0">
      <h2 className="px-5 pt-4 pb-1 font-semibold text-muted-foreground text-sm">
        Sessions
      </h2>
      <SettingsList>
        {error ? (
          <li role="alert" className="px-5 py-3 text-destructive text-sm">
            {error}
          </li>
        ) : (
          <SessionList sessions={summarizeSessions(sessions ?? [])} />
        )}
      </SettingsList>
    </Card>
  );
}
