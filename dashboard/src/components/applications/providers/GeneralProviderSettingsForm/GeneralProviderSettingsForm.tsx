import { ProviderSetting } from '@/components/applications/settings/providers/helpers';
import type { Provider } from '@/types/providers';

// TODO: See TODO comment in ProviderSettings.tsx about the react-hook-form
// refactor
export interface GeneralProviderSettingsFormProps {
  provider: Provider;
  authProviderClientId: string;
  authProviderClientSecret: string;
  handleClientIdChange: (value: string) => void;
  handleClientSecretChange: (value: string) => void;
}

export default function GeneralProviderSettingsForm({
  provider,
  authProviderClientId,
  authProviderClientSecret,
  handleClientIdChange,
  handleClientSecretChange,
}: GeneralProviderSettingsFormProps) {
  return (
    <div className="space-y-3 divide-y-1 divide-divide">
      <ProviderSetting
        title={`${provider.name} Client ID`}
        desc={`Copy from ${provider.name} and enter here`}
        inputPlaceholder="Paste Client ID here"
        input
        inputValue={authProviderClientId}
        inputOnChange={handleClientIdChange}
        inputType="text"
      />

      <ProviderSetting
        title={`${provider.name} Client Secret`}
        desc={`Copy from ${provider.name} and enter here`}
        inputPlaceholder="Paste secret here"
        input
        inputValue={authProviderClientSecret}
        inputOnChange={handleClientSecretChange}
        inputType="password"
      />
    </div>
  );
}
