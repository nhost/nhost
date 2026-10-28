import type { ReactNode } from 'react';
import { GitHubConnectedNotice } from '@/features/orgs/projects/common/components/settings/GitHubConnectedNotice';

interface SettingsPageProps {
  /** The page title, usually the label of the active settings navigation link. */
  title: string;
  children: ReactNode;
}

/**
 * A project settings page: its title, the GitHub sync reminder below it while a
 * repository is connected, then the settings themselves.
 */
export default function SettingsPage({ title, children }: SettingsPageProps) {
  return (
    <div className="grid grid-flow-row gap-6">
      <h1 className="font-semibold text-2.5xl">{title}</h1>
      <GitHubConnectedNotice />
      {children}
    </div>
  );
}
