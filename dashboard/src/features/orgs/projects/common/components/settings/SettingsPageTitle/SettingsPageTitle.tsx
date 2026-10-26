import type { PropsWithChildren } from 'react';

/**
 * The H1 at the top of a settings page: the active item of the settings
 * secondary menu (e.g. "Postgres version"). Pass it as the `title` of
 * `SettingsArea` so it sits above the GitHub notice and the page content.
 */
export default function SettingsPageTitle({ children }: PropsWithChildren) {
  return <h1 className="font-semibold text-2.5xl">{children}</h1>;
}
