import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen } from '@/tests/testUtils';
import ProjectRegionFlag from './ProjectRegionFlag';

const frankfurt = {
  id: 'eu',
  name: 'eu-central-1',
  countryCode: 'DE',
  city: 'Frankfurt',
};

describe('ProjectRegionFlag', () => {
  it('shows the flag and the region on hover', async () => {
    const user = userEvent.setup();
    render(<ProjectRegionFlag region={frankfurt} />);

    const button = screen.getByRole('button', {
      name: 'Region: Frankfurt (eu-central-1)',
    });
    expect(button.querySelector('img')?.getAttribute('src')).toContain(
      'DE.svg',
    );

    await user.hover(button);
    expect(
      await screen.findByRole('tooltip', { name: 'Frankfurt (eu-central-1)' }),
    ).toBeInTheDocument();
  });

  it('shows the region when the flag gets keyboard focus', async () => {
    const user = userEvent.setup();
    render(<ProjectRegionFlag region={frankfurt} />);

    await user.tab();
    expect(
      await screen.findByRole('tooltip', { name: 'Frankfurt (eu-central-1)' }),
    ).toBeInTheDocument();
  });

  it('falls back to a globe when there is no country code', () => {
    render(<ProjectRegionFlag region={{ ...frankfurt, countryCode: '' }} />);

    const button = screen.getByRole('button', {
      name: 'Region: Frankfurt (eu-central-1)',
    });
    expect(button.querySelector('img')).toBeNull();
    expect(button.querySelector('svg.lucide-globe')).not.toBeNull();
  });

  it('falls back to a globe when the flag fails, then recovers on a new region', () => {
    const { rerender } = render(
      <ProjectRegionFlag region={{ ...frankfurt, countryCode: 'XX' }} />,
    );

    const button = screen.getByRole('button');
    fireEvent.error(button.querySelector('img') as HTMLImageElement);
    expect(button.querySelector('img')).toBeNull();
    expect(button.querySelector('svg.lucide-globe')).not.toBeNull();

    rerender(<ProjectRegionFlag region={frankfurt} />);
    expect(screen.getByRole('button').querySelector('img')).not.toBeNull();
  });

  it('labels the region by name only when the city is missing', () => {
    render(<ProjectRegionFlag region={{ ...frankfurt, city: '' }} />);

    expect(
      screen.getByRole('button', { name: 'Region: eu-central-1' }),
    ).toBeInTheDocument();
  });

  it('labels an unknown region when name and city are missing', () => {
    render(<ProjectRegionFlag region={{ ...frankfurt, name: '', city: '' }} />);

    expect(
      screen.getByRole('button', { name: 'Region: Unknown region' }),
    ).toBeInTheDocument();
  });
});
