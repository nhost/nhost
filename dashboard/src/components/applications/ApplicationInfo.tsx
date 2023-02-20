import { useDeleteApplicationMutation } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import ArrowRightIcon from '@/ui/v2/icons/ArrowRightIcon';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import { copy } from '@/utils/copy';
import { getApplicationStatusString } from '@/utils/helpers';
import { triggerToast } from '@/utils/toast';
import { formatDistance } from 'date-fns';
import { useRouter } from 'next/router';

export default function ApplicationInfo() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [deleteApplication, { client }] = useDeleteApplicationMutation();
  const router = useRouter();

  async function handleClickRemove() {
    await deleteApplication({
      variables: {
        appId: currentApplication.id,
      },
    });
    await router.push('/');
    await client.refetchQueries({
      include: ['getOneUser'],
    });
    triggerToast(`${currentApplication.name} deleted`);
  }

  return (
    <div className="mt-4 grid grid-flow-row gap-4">
      <div className="grid grid-flow-row justify-center gap-0.5">
        <Text variant="subtitle2">Application ID:</Text>

        <Button
          variant="borderless"
          onClick={() => copy(currentApplication.id, 'Application ID')}
          className="py-1 text-xs"
        >
          {currentApplication.id}
        </Button>
      </div>

      <div className="grid grid-flow-row justify-center gap-0.5">
        <Text variant="subtitle2">Desired State:</Text>

        <Button
          variant="borderless"
          onClick={() =>
            copy(
              currentApplication.desiredState.toString(),
              'Application Desired State',
            )
          }
          className="py-1 text-xs"
        >
          {getApplicationStatusString(currentApplication.desiredState)}
        </Button>
      </div>

      <div className="grid grid-flow-row gap-0.5">
        <Text variant="subtitle2">Region:</Text>

        <Text variant="subtitle1">{currentApplication.region.city}</Text>
      </div>

      <div className="grid grid-flow-row gap-0.5">
        <Text variant="subtitle2">Created:</Text>

        <Text variant="subtitle1">
          {formatDistance(new Date(currentApplication.createdAt), new Date(), {
            addSuffix: true,
          })}
        </Text>
      </div>

      <div className="grid grid-flow-row gap-2">
        <Link
          href={`https://staging.nhost.run/console/data/default/schema/public/tables/app_state_history/browse?filter=app_id%3B%24eq%3B${currentApplication.id}`}
          target="_blank"
          rel="noreferrer noopener"
          className="grid grid-flow-col items-center justify-center gap-1 p-2"
          underline="hover"
        >
          App State History <ArrowRightIcon />
        </Link>

        <Button color="error" variant="outlined" onClick={handleClickRemove}>
          Delete Project
        </Button>
      </div>
    </div>
  );
}
