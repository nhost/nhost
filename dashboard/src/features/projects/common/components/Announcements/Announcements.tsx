import { Text } from '@/components/ui/v2/Text';
import { useGetAnnouncementsQuery } from '@/utils/__generated__/graphql';
import formatDistance from 'date-fns/formatDistance';

export default function Announcements() {
  const { data, loading, error } = useGetAnnouncementsQuery();

  const announcements = data?.announcements || [];

  if (loading || error) {
    return null;
  }

  return (
    <section>
      <Text color="secondary" className="mb-2">
        Latest announcements
      </Text>

      <ul className="relative space-y-4 border-l border-gray-200 dark:border-gray-700">
        {announcements.map((item) => (
          <li className="ml-4">
            <div className="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full border border-white bg-gray-200 dark:border-gray-900 dark:bg-gray-700" />

            <div className="flex flex-col">
              <time className="mb-1 text-sm font-normal leading-none text-gray-400 dark:text-gray-500">
                {formatDistance(new Date(item.createdAt), new Date(), {
                  addSuffix: true,
                })}
              </time>
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer text-base font-normal text-gray-500 hover:underline dark:text-gray-400"
              >
                {item.content}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
