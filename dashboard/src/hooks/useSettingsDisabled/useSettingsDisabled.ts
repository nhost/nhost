import { getConfigServerUrl, isPlatform } from '@/utils/env';

export default function useSettingsDisabled() {
  const noConfigServerEnvVariableSet = getConfigServerUrl() === '';
  const notPlatform = !isPlatform();

  return notPlatform && noConfigServerEnvVariableSet;
}
