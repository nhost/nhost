import { getConfigServerUrl, isPlatform } from '@/utils/env';

export function isSettingsDisabled() {
  const noConfigServerEnvVariableSet = getConfigServerUrl() === '';
  const notPlatform = !isPlatform();

  return notPlatform && noConfigServerEnvVariableSet;
}

export default function useSettingsDisabled() {
  return isSettingsDisabled();
}
