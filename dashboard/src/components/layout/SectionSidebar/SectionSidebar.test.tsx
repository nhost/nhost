import {
  SectionSidebarButton,
  SectionSidebarGroup,
  SectionSidebarLink,
  SectionSidebarNav,
} from '@/components/layout/SectionSidebar';
import { render, screen, within } from '@/tests/testUtils';

const renderSidebar = () =>
  render(
    <SectionSidebarNav ariaLabel="Backups navigation">
      <SectionSidebarGroup label="Backups">
        <SectionSidebarLink href="/database/backups" active>
          Scheduled backups
        </SectionSidebarLink>
        <SectionSidebarButton>Point-in-Time</SectionSidebarButton>
      </SectionSidebarGroup>
      <SectionSidebarGroup label="Transfer">
        <SectionSidebarLink href="/database/backups/import" disabled>
          Import backup
        </SectionSidebarLink>
      </SectionSidebarGroup>
    </SectionSidebarNav>,
  );

describe('SectionSidebarNav', () => {
  it('renders grouped secondary navigation', () => {
    renderSidebar();

    const nav = screen.getByRole('navigation', {
      name: 'Backups navigation',
    });

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(within(nav).getByText('Backups')).toHaveClass('uppercase');
    expect(within(nav).getByText('Transfer')).toHaveClass('uppercase');
  });

  it('renders active route links with page semantics', () => {
    renderSidebar();

    const link = screen.getByRole('link', { name: 'Scheduled backups' });

    expect(link).toHaveAttribute('href', '/database/backups');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveClass('bg-muted', 'text-primary');
  });

  it('renders disabled links without anchors', () => {
    renderSidebar();

    expect(
      screen.queryByRole('link', { name: 'Import backup' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Import backup')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('renders local-navigation buttons with default button type', () => {
    renderSidebar();

    expect(
      screen.getByRole('button', { name: 'Point-in-Time' }),
    ).toHaveAttribute('type', 'button');
  });
});
