import { TextLink } from '@/components/ui/v3/text-link';
import { InfoAlert } from '@/features/orgs/components/InfoAlert';

function PiTRNotEnabled() {
  return (
    <InfoAlert>
      To enable Point-in-Time recovery, enable it in the{' '}
      <TextLink
        from="/orgs/$orgSlug/projects/$appSubdomain"
        to="/orgs/$orgSlug/projects/$appSubdomain/database/settings"
        params
        search={{ tab: 'point-in-time' }}
      >
        database settings.
      </TextLink>
    </InfoAlert>
  );
}

export default PiTRNotEnabled;
