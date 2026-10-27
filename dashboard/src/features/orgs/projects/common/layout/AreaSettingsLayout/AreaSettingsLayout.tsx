import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { SettingsGuard } from '@/features/orgs/guards/SettingsGuard';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
import { AreaSidebarLayout } from '@/features/orgs/projects/common/layout/AreaSidebarLayout';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

interface AreaSettingsLayoutProps {
  /** The area's settings navigation, usually an `AreaSidebarRoot`. */
  sidebar: ReactNode;
  /** The page title for each `tab` query value, the same labels as the sidebar. */
  titles: Record<string, string>;
  children: ReactNode;
}

/**
 * The settings page of a project area: an `AreaSidebarLayout` whose content is
 * the settings column. `AreaSidebarLayout` owns the vertical padding, so the
 * settings column adds none.
 */
export default function AreaSettingsLayout({
  sidebar,
  titles,
  children,
}: AreaSettingsLayoutProps) {
  const router = useRouter();
  const tab = getSingleQueryParam(router.query.tab);

  return (
    <AreaSidebarLayout sidebar={sidebar}>
      <SettingsGuard>
        <SettingsArea className="py-0" title={tab ? titles[tab] : undefined}>
          {children}
        </SettingsArea>
      </SettingsGuard>
    </AreaSidebarLayout>
  );
}
