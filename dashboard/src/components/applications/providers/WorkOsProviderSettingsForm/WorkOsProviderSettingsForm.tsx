import { ProviderSetting } from '@/components/applications/settings/providers/helpers';

// TODO: See TODO comment in ProviderSettings.tsx about the react-hook-form
// refactor
export interface WorkOsProviderSettingsFormProps {
  defaultDomain: string;
  defaultOrganization: string;
  defaultConnection: string;
  handleDefaultDomainChange: (value: string) => void;
  handleDefaultOrganizationChange: (value: string) => void;
  handleDefaultConnectionChange: (value: string) => void;
}

export default function WorkOsProviderSettingsForm({
  defaultDomain,
  defaultOrganization,
  defaultConnection,
  handleDefaultDomainChange,
  handleDefaultOrganizationChange,
  handleDefaultConnectionChange,
}: WorkOsProviderSettingsFormProps) {
  return (
    <div className="grid grid-flow-row gap-3 divide-y-1">
      <ProviderSetting
        title="Default Domain"
        desc=""
        inputPlaceholder=""
        input
        inputValue={defaultDomain}
        inputOnChange={handleDefaultDomainChange}
        inputType="text"
      />

      <ProviderSetting
        title="Default Organization"
        desc=""
        inputPlaceholder=""
        input
        inputValue={defaultOrganization}
        inputOnChange={handleDefaultOrganizationChange}
        inputType="text"
      />

      <ProviderSetting
        title="Default Connection"
        desc=""
        inputPlaceholder=""
        input
        inputValue={defaultConnection}
        inputOnChange={handleDefaultConnectionChange}
        inputType="text"
      />
    </div>
  );
}
