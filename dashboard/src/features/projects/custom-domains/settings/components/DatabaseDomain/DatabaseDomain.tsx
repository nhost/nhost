import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Input } from '@/components/ui/v2/Input';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { VerifyDomain } from '@/features/projects/custom-domains/settings/components/VerifyDomain';
import { useState } from 'react';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  database_fqdn: Yup.string().required(),
});

export type DatabaseDomainFormValues = Yup.InferType<typeof validationSchema>;

export default function DatabaseDomain() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [dbFQDN, setDbFQDN] = useState('');

  const postgresHost = generateAppServiceUrl(
    currentProject.subdomain,
    currentProject.region,
    'db',
  ).replace('https://', '');

  return (
    <SettingsContainer
      title="Database Domain"
      description="Enter below your custom domain for the PostgreSQL database to verify. Once verified there is no need to save this value as no configuration on our end is required."
      slotProps={{
        submitButton: {
          hidden: true,
        },
        footer: {
          className: 'hidden',
        },
      }}
      className="grid grid-flow-row gap-x-4 gap-y-4 px-4 lg:grid-cols-5"
    >
      <Input
        id="database_fqdn"
        name="database_fqdn"
        type="string"
        fullWidth
        className="col-span-5 lg:col-span-2"
        placeholder="db.mydomain.dev"
        onChange={(e) => {
          setDbFQDN(e.target.value);
        }}
        slotProps={{ inputRoot: { min: 1, max: 100 } }}
      />
      <div className="col-span-5 row-start-2">
        <VerifyDomain
          recordType="CNAME"
          hostname={dbFQDN}
          value={`${postgresHost}.`}
        />
      </div>
    </SettingsContainer>
  );
}
