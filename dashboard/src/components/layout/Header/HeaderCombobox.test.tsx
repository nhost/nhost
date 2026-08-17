import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import { render, screen } from '@/tests/testUtils';

const options = [{ value: 'org-a', label: 'Org A' }];

describe('HeaderCombobox', () => {
  it('renders a link and icon-only trigger when linkHref and linkContent are provided', () => {
    render(
      <HeaderCombobox
        value="org-a"
        onChange={vi.fn()}
        options={options}
        linkHref="/orgs/org-a/projects"
        linkContent="Org A"
        aria-label="Switch organization"
      />,
    );

    expect(screen.getByRole('link', { name: 'Org A' })).toHaveAttribute(
      'href',
      '/orgs/org-a/projects',
    );
    expect(
      screen.getByRole('combobox', { name: 'Switch organization' }),
    ).not.toHaveTextContent('Org A');
  });

  it('renders the normal combobox trigger content without linkHref and linkContent', () => {
    render(
      <HeaderCombobox
        value={null}
        onChange={vi.fn()}
        options={options}
        placeholder="Select organization"
      />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Select organization')).toBeInTheDocument();
  });
});
