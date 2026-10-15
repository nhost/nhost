import { createFileRoute } from '@tanstack/react-router';
import { DeleteOrg } from '@/features/orgs/components/general/components/DeleteOrg';
import { GeneralSettings } from '@/features/orgs/components/general/components/GeneralSettings';
import { Soc2Download } from '@/features/orgs/components/general/components/Soc2Download';

export const Route = createFileRoute('/orgs/$orgSlug/_org/settings')({
  component: OrgSettings,
});

function OrgSettings() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8">
      <GeneralSettings />
      <Soc2Download />
      <DeleteOrg />
    </div>
  );
}
