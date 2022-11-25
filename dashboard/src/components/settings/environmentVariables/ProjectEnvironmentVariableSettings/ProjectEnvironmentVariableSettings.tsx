import SettingsContainer from '@/components/settings/SettingsContainer';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import { useGetEnvironmentVariablesQuery } from '@/utils/__generated__/graphql';
import { format } from 'date-fns';

export default function ProjectEnvironmentVariableSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { data, loading, error } = useGetEnvironmentVariablesQuery({
    variables: {
      id: currentApplication?.id,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading environment variables..."
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <SettingsContainer
      title="Project Environment Variables"
      description="Environment Variables are key-value pairs configured outside your source code. They are used to store environment-specific values such as API keys."
      docsLink="https://docs.nhost.io/platform/environment-variables"
      docsTitle="Environment Variables"
      className="p-0"
    >
      <div className="grid grid-cols-2 border-b-1 border-gray-200 px-4 py-3">
        <Text className="font-medium">Variable Name</Text>
        <Text className="font-medium">Updated</Text>
      </div>

      <List>
        {data?.environmentVariables?.map((environmentVariable) => (
          <ListItem.Root
            className="px-4 grid grid-cols-2"
            key={environmentVariable.name}
          >
            <ListItem.Text>{environmentVariable.name}</ListItem.Text>

            <Text className="font-medium">
              {format(new Date(environmentVariable.updatedAt), 'dd MMM yyyy')}
            </Text>
          </ListItem.Root>
        ))}
      </List>
    </SettingsContainer>
  );
}
