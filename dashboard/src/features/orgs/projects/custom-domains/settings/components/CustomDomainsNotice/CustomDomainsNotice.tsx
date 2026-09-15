import {
  SettingsCard,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { useHasCustomDomain } from '@/features/orgs/projects/custom-domains/settings/hooks/useHasCustomDomain';

/**
 * The flat fee is charged once per project, so the pitch only shows while
 * the project has no custom domain on any service.
 */
export default function CustomDomainsNotice() {
  const { hasCustomDomain, loading } = useHasCustomDomain();

  if (loading || hasCustomDomain) {
    return null;
  }

  return (
    <SettingsCard>
      <SettingsCardHeader
        title="Custom Domains"
        description="Add a custom domain to your project for only a $10 flat fee 🚀"
      />
      <SettingsCardFooter>
        <SettingsDocsLink
          href="https://docs.nhost.io/platform/cloud/custom-domains"
          title="Custom Domains"
        />
      </SettingsCardFooter>
    </SettingsCard>
  );
}
