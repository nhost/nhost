import { useRouter } from 'next/router';
import type { DataBrowserGridProps } from './DataBrowserGrid';
import DataBrowserGrid from './DataBrowserGrid';

export default function DataBrowserGridContainer(props: DataBrowserGridProps) {
  const { query } = useRouter();
  const { tableSlug } = query;

  return <DataBrowserGrid key={tableSlug as string} {...props} />;
}
