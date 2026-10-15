export interface PageTitleProps {
  title: string;
}

/**
 * Sets the document title. React hoists `<title>` into `<head>` and the
 * deepest one rendered wins; `index.html` provides the `Nhost` default.
 */
export default function PageTitle({ title }: PageTitleProps) {
  return <title>{`${title} - Nhost`}</title>;
}
