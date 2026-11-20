import { listSessions } from '@/app/account/actions';
import SessionList from '@/app/account/SessionList';
import { sortSessions } from '@/app/account/sessions';
import { SettingsList } from '@/components/Setting';
import { Card } from '@/components/ui/card';
import { useLoad } from '@/lib/useLoad';

/** The account's sessions, each with a way to end it. */
export default function SessionsCard() {
  const loaded = useLoad(listSessions);

  return (
    <Card className="gap-0 py-0">
      <h2 className="px-5 pt-4 pb-1 font-semibold text-muted-foreground text-sm">
        Sessions
      </h2>
      <SettingsList>
        {!loaded ? (
          <li className="flex min-h-12 items-center px-5 py-2 text-muted-foreground text-xs">
            Loading…
          </li>
        ) : loaded.error ? (
          <li role="alert" className="px-5 py-3 text-destructive text-sm">
            {loaded.error}
          </li>
        ) : (
          <SessionList sessions={sortSessions(loaded.sessions ?? [])} />
        )}
      </SettingsList>
    </Card>
  );
}
