import { useRouter } from 'next/router';
import { useMemo } from 'react';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';

const projectEventsPages = [
  {
    name: 'Event Triggers',
    slug: 'event-triggers',
    route: 'event-triggers',
  },
  {
    name: 'Cron Triggers',
    slug: 'cron-triggers',
    route: 'cron-triggers',
  },
  {
    name: 'One-Off Scheduled Events',
    slug: 'one-offs',
    route: 'one-offs',
  },
].map((item) => ({
  label: item.name,
  value: item.slug,
  route: item.route,
}));

export default function ProjectEventsPagesComboBox() {
  const {
    query: { orgSlug, appSubdomain },
    push,
    asPath,
  } = useRouter();

  const pathSegments = useMemo(() => asPath.split('/'), [asPath]);
  const isEventsPage = pathSegments.includes('events');
  const eventsPageFromUrl = isEventsPage
    ? pathSegments[6] || 'event-triggers'
    : null;

  const selectedEventsPage = projectEventsPages.find(
    (item) => item.value === eventsPageFromUrl,
  );

  const options = projectEventsPages.map((page) => ({
    label: page.label,
    value: page.value,
  }));

  return (
    <HeaderCombobox
      options={options}
      value={selectedEventsPage?.value ?? null}
      placeholder="Select a page"
      searchPlaceholder="Select a page..."
      onChange={(value) => {
        const option = projectEventsPages.find((page) => page.value === value);
        if (option) {
          push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/events/${option.route}/`,
          );
        }
      }}
    />
  );
}
