import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * The app's own 404, for an address matching no route and for the `notFound()`
 * that `/u/[id]` throws.
 *
 * Without this file Next renders its built-in one, and that is not merely
 * unstyled: it injects a global `body` rule keyed to `prefers-color-scheme`,
 * which outranks the `@layer base` rule in `globals.css` and ignores the theme
 * the toggle actually set. The result was a black page under a light nav, with
 * no way back to the app.
 *
 * The wording is deliberately incurious about which case it is answering.
 * `/u/[id]` gives the same response for a profile that does not exist and one
 * whose owner turned their page off, and naming the difference here would undo
 * that: it would turn this page into a way to test whether an account exists.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 pt-24 text-center">
      <h1 className="font-bold text-2xl tracking-tight">Page not found</h1>
      <p className="text-muted-foreground text-sm">
        That address doesn&apos;t lead anywhere. It may have moved, or never
        existed.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
