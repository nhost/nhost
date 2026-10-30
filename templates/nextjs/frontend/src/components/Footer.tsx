import BackendStatus from '@/components/BackendStatus';

/**
 * On every page and pinned to the bottom of the window, so which backend the
 * app is connected to is never more than a glance away, even halfway down a
 * long page.
 */
export default function Footer() {
  return (
    <footer className="sticky bottom-0 z-40 border-t bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-4 text-sm">
        <BackendStatus />
        <a
          href="https://docs.nhost.io"
          target="_blank"
          rel="noreferrer"
          className="font-medium underline-offset-4 hover:underline"
        >
          Docs <span aria-hidden="true">↗</span>
        </a>
      </div>
    </footer>
  );
}
