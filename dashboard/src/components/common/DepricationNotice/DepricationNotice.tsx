import { Alert } from '@/components/ui/v2/Alert';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';

export default function DepricationNotice() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  return (
    !currentProject?.providersUpdated && (
      <Alert severity="warning" className="grid place-content-center">
        <Text color="warning" className="max-w-3xl text-sm">
          On December 1st the old backend domain will cease to work. You need to
          make sure your client is instantiated using the subdomain and region
          and update your oauth2 settings. You can find more information{' '}
          <a
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            href="https://github.com/nhost/nhost/discussions/2303"
          >
            here
          </a>
          .
        </Text>
      </Alert>
    )
  );
}
