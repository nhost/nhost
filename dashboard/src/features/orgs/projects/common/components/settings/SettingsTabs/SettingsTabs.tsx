import type { ComponentType } from 'react';
import { SettingsPage } from '@/features/orgs/projects/common/components/settings/SettingsPage';
import useActiveSettingsTab, {
  type SettingsTabKey,
} from '@/features/orgs/projects/common/components/settings/SettingsTabs/hooks/useActiveSettingsTab';

export interface SettingsTab {
  /** The page title, the same as the tab's sidebar link. */
  title: string;
  Component: ComponentType;
}

interface SettingsTabsProps<T extends Record<string, SettingsTab>> {
  /** The tabs by their `tab` query value, the same as the sidebar links. */
  tabs: T;
  defaultTab: SettingsTabKey<T>;
}

/** Renders the settings tab selected by the `tab` query parameter. */
export default function SettingsTabs<T extends Record<string, SettingsTab>>({
  tabs,
  defaultTab,
}: SettingsTabsProps<T>) {
  const tab = useActiveSettingsTab(tabs, defaultTab);

  // Only before the router is ready, which the project guard rules out on the
  // platform but not for local projects.
  if (!tab) {
    return null;
  }

  const { title, Component } = tabs[tab];

  return (
    <SettingsPage title={title}>
      <Component />
    </SettingsPage>
  );
}
