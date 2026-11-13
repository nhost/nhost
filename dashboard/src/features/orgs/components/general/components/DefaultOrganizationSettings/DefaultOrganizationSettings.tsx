import { toast } from 'react-hot-toast';
import OrganizationPlanBadge from '@/components/layout/Header/OrganizationPlanBadge';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Switch } from '@/components/ui/v3/switch';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import { useDefaultOrganization } from '@/features/orgs/hooks/useDefaultOrganization';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { VariableGroup } from '@/features/orgs/projects/environmentVariables/settings/components/VariableGroup';
import { type Org, useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { getToastStyleProps } from '@/utils/constants/settings';

export default function DefaultOrganizationSettings() {
  const isPlatform = useIsPlatform();
  const { orgs, currentOrg, loading, error } = useOrgs();
  const { defaultOrgId, isReady, setDefaultOrgId, clearDefaultOrg } =
    useDefaultOrganization();

  if (!isPlatform || loading || error || !currentOrg || !isReady) {
    return null;
  }

  const isOnlyOrg = orgs.length === 1;
  const hasDefault = orgs.some((org) => org.id === defaultOrgId);
  const toastStyle = getToastStyleProps();

  function isDefault(org: Org) {
    return isOnlyOrg || org.id === defaultOrgId;
  }

  function handleCheckedChange(org: Org, checked: boolean) {
    try {
      if (checked) {
        setDefaultOrgId(org.id);
      } else {
        clearDefaultOrg();
      }

      toast.success(
        checked
          ? `${org.name} is now your default organization.`
          : `${org.name} is no longer your default organization.`,
        { style: toastStyle.style, ...toastStyle.success },
      );
    } catch (saveError) {
      console.error('Failed to save the default organization:', saveError);
      toast.error('Could not save your default organization. Try again.', {
        style: toastStyle.style,
        ...toastStyle.error,
      });
    }
  }

  return (
    <SettingsCard>
      <SettingsCardHeader
        size="lg"
        title="Default organization"
        description="Choose which organization's projects open when you sign in. Saved in this browser."
      />

      <SettingsCardContent>
        <VariableGroup>
          {orgs.map((org) => (
            <TableRow key={org.id}>
              <TableCell>
                <div className="flex min-w-0 items-center">
                  <span className="truncate font-medium">{org.name}</span>
                  <OrganizationPlanBadge plan={org.plan?.name} />
                  {org.id === currentOrg.id && (
                    <span className="ml-2 inline-flex shrink-0 items-center rounded-full border border-success/40 px-2 py-px font-medium text-success text-xs">
                      You're here
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="w-24">
                <div className="flex justify-end">
                  <Switch
                    aria-label={`Set ${org.name} as default`}
                    checked={isDefault(org)}
                    disabled={isOnlyOrg}
                    onCheckedChange={(checked) =>
                      handleCheckedChange(org, checked)
                    }
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </VariableGroup>

        {isOnlyOrg && (
          <p className="text-muted-foreground text-sm">
            Your only organization is always your default.
          </p>
        )}

        {!isOnlyOrg && !hasDefault && (
          <p className="text-muted-foreground text-sm">
            No default is set, so you land on the organization you last opened.
          </p>
        )}
      </SettingsCardContent>
    </SettingsCard>
  );
}
