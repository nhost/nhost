import type { ReactNode } from 'react';
import { SettingsGuard } from '@/features/orgs/guards/SettingsGuard';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
import { AreaSidebarLayout } from '@/features/orgs/projects/common/layout/AreaSidebarLayout';

interface AreaSettingsLayoutProps {
  /** The area's settings navigation, usually an `AreaSidebarRoot`. */
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * The settings page of a project area: an `AreaSidebarLayout` whose content is
 * the settings column. `AreaSidebarLayout` owns the vertical padding, so the
 * settings column adds none.
 */
export default function AreaSettingsLayout({
  sidebar,
  children,
}: AreaSettingsLayoutProps) {
  return (
    <AreaSidebarLayout sidebar={sidebar}>
      <SettingsGuard>
        <SettingsArea className="py-0">{children}</SettingsArea>
      </SettingsGuard>
    </AreaSidebarLayout>
  );
}
