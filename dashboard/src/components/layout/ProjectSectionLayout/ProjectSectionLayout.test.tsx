import { ProjectSectionLayout } from '@/components/layout/ProjectSectionLayout';
import { RouteTabLink, RouteTabs } from '@/components/ui/v3/route-tabs';
import { render, screen } from '@/tests/testUtils';

describe('ProjectSectionLayout', () => {
  it('renders route tabs, optional sidebar, and content in section slots', () => {
    render(
      <ProjectSectionLayout
        navigation={
          <RouteTabs aria-label="Database navigation">
            <RouteTabLink href="/database/browser" active>
              Table editor
            </RouteTabLink>
          </RouteTabs>
        }
        sidebar={<aside aria-label="Database sidebar">Tables</aside>}
      >
        <main>Database content</main>
      </ProjectSectionLayout>,
    );

    expect(
      screen.getByRole('navigation', { name: 'Database navigation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: 'Database sidebar' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Database content');
  });

  it('allows slot class names to be customized', () => {
    render(
      <ProjectSectionLayout
        data-testid="section-layout"
        className="custom-root"
        navigation={<span>Tabs</span>}
        navigationClassName="custom-navigation"
        bodyClassName="custom-body"
        contentClassName="custom-content"
      >
        <span>Content</span>
      </ProjectSectionLayout>,
    );

    const layout = screen.getByTestId('section-layout');
    const navigationWrapper = screen.getByText('Tabs').parentElement;
    const contentWrapper = screen.getByText('Content').parentElement;

    expect(layout).toHaveClass('custom-root');
    expect(navigationWrapper).toHaveClass('custom-navigation');
    expect(contentWrapper).toHaveClass('custom-content');
    expect(contentWrapper?.parentElement).toHaveClass('custom-body');
  });
});
