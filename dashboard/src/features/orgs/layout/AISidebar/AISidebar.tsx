import { useRouter } from 'next/router';
import { ListNavLink } from '@/components/common/NavLink';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import { List } from '@/components/ui/v2/List';
import type { ListItemButtonProps } from '@/components/ui/v2/ListItem';
import { ListItem } from '@/components/ui/v2/ListItem';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

interface AINavLinkProps extends ListItemButtonProps {
  href: string;
  exact?: boolean;
}

function AINavLink({ exact = true, href, children, ...props }: AINavLinkProps) {
  const router = useRouter();

  const {
    query: { orgSlug, appSubdomain },
  } = router;

  const baseUrl = `/orgs/${orgSlug}/projects/${appSubdomain}/ai`;
  const finalUrl = href && href !== '/' ? `${baseUrl}${href}` : baseUrl;

  const active = exact
    ? router.asPath === finalUrl
    : router.asPath.startsWith(finalUrl);

  return (
    <ListItem.Root>
      <ListItem.Button
        dense
        href={finalUrl}
        component={ListNavLink}
        selected={active}
        {...props}
      >
        <ListItem.Text>{children}</ListItem.Text>
      </ListItem.Button>
    </ListItem.Root>
  );
}

export default function AISidebar() {
  const { project } = useProject();

  if (!project) {
    return null;
  }

  return (
    <FeatureSidebar
      mobileBreakpoint="md"
      withErrorBoundary={false}
      className="px-2"
    >
      {(collapse) => (
        <nav aria-label="Settings navigation">
          <List className="grid gap-2">
            <AINavLink href="/auto-embeddings" exact={false} onClick={collapse}>
              Auto-Embeddings
            </AINavLink>
            <AINavLink href="/assistants" exact={false} onClick={collapse}>
              Assistants
            </AINavLink>
            <AINavLink href="/file-stores" exact={false} onClick={collapse}>
              File Stores
            </AINavLink>
          </List>
        </nav>
      )}
    </FeatureSidebar>
  );
}
