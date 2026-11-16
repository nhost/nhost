export default function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-4xl items-center justify-center px-6 py-4 text-sm">
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
