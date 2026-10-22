import BackendStatus from '@/components/BackendStatus';

const resources = [
  { href: 'https://docs.nhost.io', label: 'Nhost docs' },
  { href: 'https://docs.nhost.io/products/auth', label: 'Auth guide' },
  { href: 'https://nextjs.org/docs', label: 'Next.js docs' },
];

/**
 * On every page, so which backend the app is connected to is never more than
 * a glance away. `CenteredLayout` leaves room for its height.
 */
export default function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4 text-sm">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {resources.map((resource) => (
            <a
              key={resource.href}
              href={resource.href}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline-offset-4 hover:underline"
            >
              {resource.label} <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
        <BackendStatus />
      </div>
    </footer>
  );
}
