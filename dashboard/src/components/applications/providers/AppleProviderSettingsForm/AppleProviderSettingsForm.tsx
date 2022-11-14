import { ProviderSetting } from '@/components/applications/settings/providers/helpers';

// TODO: See TODO comment in ProviderSettings.tsx about the react-hook-form
// refactor
export interface AppleProviderSettingsFormProps {
  authProviderClientId: string;
  authProviderTeamId: string;
  authProviderKeyId: string;
  authProviderClientSecret: string;
  handleClientIdChange: (value: string) => void;
  handleTeamIdChange: (value: string) => void;
  handleKeyIdChange: (value: string) => void;
  handleClientSecretChange: (value: string) => void;
}

export default function AppleProviderSettingsForm({
  authProviderClientId,
  authProviderTeamId,
  authProviderKeyId,
  authProviderClientSecret,
  handleClientIdChange,
  handleTeamIdChange,
  handleKeyIdChange,
  handleClientSecretChange,
}: AppleProviderSettingsFormProps) {
  return (
    <div className="space-y-3 divide-y-1 divide-divide">
      <ProviderSetting
        title="Team ID"
        desc="Copy from Apple and enter here"
        inputPlaceholder="Paste Team ID here"
        input
        inputValue={authProviderTeamId}
        inputOnChange={handleTeamIdChange}
        inputType="text"
      />

      <ProviderSetting
        title="Service ID"
        desc="Copy from Apple and enter here"
        inputPlaceholder="Paste Service ID here"
        input
        inputValue={authProviderClientId}
        inputOnChange={handleClientIdChange}
        inputType="text"
      />

      <ProviderSetting
        title="Key ID"
        desc="Copy from Apple and enter here"
        inputPlaceholder="Paste Key ID here"
        input
        inputValue={authProviderKeyId}
        inputOnChange={handleKeyIdChange}
        inputType="text"
      />

      <ProviderSetting
        title="Private Key"
        desc="Copy from Apple and enter here"
        inputPlaceholder="Paste Private Key here"
        input
        inputValue={authProviderClientSecret.replace(/\\n/gi, '\n')}
        inputOnChange={handleClientSecretChange}
        inputType="text"
        multiline
      />
    </div>
  );
}
