import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen } from '@/tests/testUtils';
import ProjectRegion from './ProjectRegion';

const frankfurt = {
  id: 'eu',
  name: 'eu-central-1',
  countryCode: 'DE',
  city: 'Frankfurt',
};

function flags() {
  return Array.from(document.querySelectorAll('img')).filter((img) =>
    img.getAttribute('src')?.includes('/assets/flags/'),
  );
}

describe('ProjectRegion', () => {
  it('shows the city as text, without a flag', () => {
    render(<ProjectRegion region={frankfurt} />);

    const button = screen.getByRole('button', {
      name: 'Region: Frankfurt (eu-central-1)',
    });
    expect(button).toHaveTextContent('Frankfurt');
    expect(flags()).toHaveLength(0);
  });

  it('shows the flag and the full region on hover', async () => {
    const user = userEvent.setup();
    render(<ProjectRegion region={frankfurt} />);

    await user.hover(screen.getByRole('button'));
    expect(
      await screen.findByRole('tooltip', { name: 'Frankfurt (eu-central-1)' }),
    ).toBeInTheDocument();
    expect(flags()[0]?.getAttribute('src')).toContain('DE.svg');
  });

  it('shows the region when it gets keyboard focus', async () => {
    const user = userEvent.setup();
    render(<ProjectRegion region={frankfurt} />);

    await user.tab();
    expect(
      await screen.findByRole('tooltip', { name: 'Frankfurt (eu-central-1)' }),
    ).toBeInTheDocument();
  });

  it('leaves the flag out when there is no country code', async () => {
    const user = userEvent.setup();
    render(<ProjectRegion region={{ ...frankfurt, countryCode: '' }} />);

    await user.hover(screen.getByRole('button'));
    await screen.findByRole('tooltip', { name: 'Frankfurt (eu-central-1)' });
    expect(flags()).toHaveLength(0);
  });

  it('drops a flag that fails to load', async () => {
    const user = userEvent.setup();
    render(<ProjectRegion region={{ ...frankfurt, countryCode: 'XX' }} />);

    await user.hover(screen.getByRole('button'));
    await screen.findByRole('tooltip', { name: 'Frankfurt (eu-central-1)' });
    for (const flag of flags()) {
      fireEvent.error(flag);
    }
    expect(flags()).toHaveLength(0);
  });

  it('falls back to the region name when the city is missing', () => {
    render(<ProjectRegion region={{ ...frankfurt, city: '' }} />);

    expect(
      screen.getByRole('button', { name: 'Region: eu-central-1' }),
    ).toHaveTextContent('eu-central-1');
  });

  it('labels an unknown region when name and city are missing', () => {
    render(<ProjectRegion region={{ ...frankfurt, name: '', city: '' }} />);

    expect(
      screen.getByRole('button', { name: 'Region: Unknown region' }),
    ).toHaveTextContent('Unknown region');
  });
});
