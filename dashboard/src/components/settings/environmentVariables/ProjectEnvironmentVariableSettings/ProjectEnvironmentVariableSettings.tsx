import SettingsContainer from '@/components/settings/SettingsContainer';
import Text from '@/ui/v2/Text';

export default function ProjectEnvironmentVariableSettings() {
  return (
    <SettingsContainer
      title="Project Environment Variables"
      description="Environment Variables are key-value pairs configured outside your source code. They are used to store environment-specific values such as API keys."
      docsLink="https://docs.nhost.io/platform/environment-variables"
      docsTitle="Environment Variables"
      className="p-0"
    >
      <div className="grid grid-cols-3 border-b-1 border-gray-200 px-4 py-3">
        <Text className="font-medium">Variable Name</Text>
        <Text className="font-medium">Updated</Text>
        <Text className="font-medium">Overrides</Text>
      </div>
    </SettingsContainer>
  );
}
