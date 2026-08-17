import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

const options = [{ value: 'org-a', label: 'Org A' }];

describe('HeaderCombobox', () => {
  beforeEach(() => {
    mockPointerEvent();
  });

  it('renders a link and icon-only trigger when linkHref and linkContent are provided', async () => {
    const user = new TestUserEvent();
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

    await user.click(
      screen.getByRole('combobox', { name: 'Switch organization' }),
    );
    expect(await screen.findByRole('option', { name: 'Org A' })).toBeVisible();
  });

  it('opens the dropdown when the empty-state placeholder is clicked', async () => {
    const user = new TestUserEvent();
    const onChange = vi.fn();
    render(
      <HeaderCombobox
        value={null}
        onChange={onChange}
        options={options}
        linkContent={null}
        placeholder="Select organization"
        aria-label="Switch organization"
      />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Switch organization' }),
    ).toHaveTextContent('Select organization');

    await user.click(screen.getByText('Select organization'));
    await user.click(await screen.findByRole('option', { name: 'Org A' }));

    expect(onChange).toHaveBeenCalledWith('org-a');
  });

  it('uses linkContent as the clickable trigger label when linkHref is absent', async () => {
    const user = new TestUserEvent();
    render(
      <HeaderCombobox
        value="org-a"
        onChange={vi.fn()}
        options={options}
        linkContent={<span>Org A (Pro)</span>}
        aria-label="Switch organization"
      />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Switch organization' }),
    ).toHaveTextContent('Org A (Pro)');

    await user.click(screen.getByText('Org A (Pro)'));
    expect(await screen.findByRole('option', { name: 'Org A' })).toBeVisible();
  });
});
