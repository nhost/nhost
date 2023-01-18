import { useDialog } from '@/components/common/DialogProvider';
import Container from '@/components/layout/Container';
import ProjectStatusInfo from '@/components/project/ProjectStatusInfo';
import useProjectRedirectWhenReady from '@/hooks/common/useProjectRedirectWhenReady';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useInterval } from '@/hooks/useInterval';
import { ApplicationStatus } from '@/types/application';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { triggerToast } from '@/utils/toast';
import {
  useInsertFeatureFlagMutation,
  useUpdateApplicationMutation,
} from '@/utils/__generated__/graphql';
import { useUserEmail } from '@nhost/nextjs';
import { useEffect, useState } from 'react';

/**
 * Number of minutes to wait before enabling the "Cancel Migration" button.
 */
const MIGRATION_CANCEL_TIMEOUT_MINUTES = 15;

function MigrationDialog() {
  const { closeAlertDialog } = useDialog();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [countdownTimer, setCountdownTimer] = useState(-1);

  const minutes = Math.floor(countdownTimer / 60);
  const seconds = Math.floor(countdownTimer % 60);

  const countdownActive = countdownTimer > 0;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const rawTimestamp = localStorage.getItem(
      `migration-${currentApplication?.id}`,
    );

    if (!rawTimestamp) {
      return;
    }

    const timestamp = new Date(rawTimestamp);
    const timeDifference =
      timestamp.getTime() +
      1000 * 60 * MIGRATION_CANCEL_TIMEOUT_MINUTES -
      Date.now();

    if (timeDifference < 0) {
      setCountdownTimer(0);

      return;
    }

    setCountdownTimer(timeDifference / 1000);
  }, [currentApplication?.id]);

  useInterval(
    () =>
      setCountdownTimer((prev) => {
        if (prev === 0) {
          return 0;
        }

        return prev - 1;
      }),
    1000,
  );

  useEffect(() => {
    if (countdownTimer !== 0 || typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(`migration-${currentApplication.id}`);
  }, [countdownTimer, currentApplication.id]);

  const [updateApplication] = useUpdateApplicationMutation({
    refetchQueries: ['getOneUser'],
  });
  const [insertFeatureFlag] = useInsertFeatureFlagMutation();
  const userEmail = useUserEmail();

  async function handleCancelMigration() {
    try {
      await updateApplication({
        variables: {
          appId: currentApplication.id,
          app: {
            desiredState: ApplicationStatus.Live,
          },
        },
      });

      await insertFeatureFlag({
        variables: {
          flag: {
            appId: currentApplication.id,
            name: 'fleetcontrol_use_rds',
            value: 'console',
            description: 'Use RDS',
          },
        },
      });

      triggerToast(`${currentApplication.name} migration cancelled.`);
    } catch (e) {
      triggerToast(`Error trying to migrate ${currentApplication.name}`);
      await discordAnnounce(
        `Error trying to migrate app: ${currentApplication.subdomain} (${userEmail})`,
      );
    } finally {
      closeAlertDialog();
    }
  }

  return (
    <div className="grid grid-flow-row gap-2 px-6">
      <Text>
        Cancelling this migration will revert your project to use the shared
        Postgres instance.
      </Text>

      {!countdownActive && (
        <Alert severity="warning" className="px-3 text-left">
          Reach out to us at{' '}
          <Link
            underline="none"
            target="_blank"
            className="hover:underline focus:underline focus:outline-none"
            href="https://discord.com/channels/552499021260914688/1029043079946182676"
          >
            #migratedb
          </Link>{' '}
          if you think the migration should have finished by now.
        </Alert>
      )}

      <div className="grid grid-flow-row gap-2 pb-1">
        <Button onClick={closeAlertDialog}>Continue Migration</Button>

        <Button
          onClick={handleCancelMigration}
          variant="outlined"
          color="secondary"
          disabled={countdownActive}
        >
          {countdownActive
            ? `Cancel in ${String(minutes).padStart(2, '0')}:${String(
                seconds,
              ).padStart(2, '0')}`
            : 'Cancel Migration'}
        </Button>
      </div>
    </div>
  );
}

export default function ApplicationMigrating() {
  const { openAlertDialog } = useDialog();

  useProjectRedirectWhenReady({ pollInterval: 10000 });

  return (
    <Container className="flex flex-col gap-6">
      <ProjectStatusInfo
        className="mx-auto max-w-sm"
        title="Migration in progress"
        description="Your project is being migrated to use a dedicated and more performant Postgres instance."
        imageProps={{
          src: '/assets/migrating.svg',
          alt: 'Application Migrating',
        }}
      />
      <Button
        variant="borderless"
        color="error"
        className="mx-auto"
        onClick={() =>
          openAlertDialog({
            title: 'Cancel Migration',
            payload: <MigrationDialog />,
            props: {
              titleProps: {
                className: 'px-6',
              },
              PaperProps: {
                className: 'py-6 px-0 max-w-sm w-full',
              },
              hidePrimaryAction: true,
              hideSecondaryAction: true,
            },
          })
        }
      >
        Cancel Migration
      </Button>
    </Container>
  );
}
