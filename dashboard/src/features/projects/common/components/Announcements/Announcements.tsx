import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { useGetAnnouncementsQuery } from '@/utils/__generated__/graphql';
import formatDistance from 'date-fns/formatDistance';

export default function Announcements() {
  const { data, loading, error } = useGetAnnouncementsQuery({
    fetchPolicy: 'cache-first',
  });

  const announcements = data?.announcements || [];

  if (loading || error) {
    return null;
  }

  return (
    <section>
      <Text color="secondary" className="mb-2">
        Latest announcements
      </Text>

      <List className="relative space-y-4 border-l border-gray-200 dark:border-gray-700">
        {announcements.map((item) => (
          <ListItem.Root key={item.id} className="ml-4">
            <div className="flex flex-col">
              <time className="mb-1 text-sm font-normal leading-none text-gray-400 dark:text-gray-500">
                {formatDistance(new Date(item.createdAt), new Date(), {
                  addSuffix: true,
                })}
              </time>
              <a href={item.href} target="_blank" rel="noopener noreferrer">
                <ListItem.Button
                  dense
                  aria-label={`View ${item.content}`}
                  className="!p-1"
                >
                  <p className="text-sm">{item.content}</p>
                </ListItem.Button>
              </a>
            </div>
            <div className="absolute top-[0.15rem] -ml-[1.4rem] h-3 w-3 rounded-full border border-white bg-gray-200 dark:border-gray-900 dark:bg-gray-700" />
          </ListItem.Root>
        ))}
      </List>
    </section>
  );
}
