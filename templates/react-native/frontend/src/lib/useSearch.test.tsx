import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { useSearch } from '@/lib/useSearch';

function Search() {
  return <Text testID="search">{useSearch()}</Text>;
}

describe('useSearch', () => {
  it('rebuilds the query, repeated keys and escapes included', async () => {
    await renderRouter(
      { 'items/[id]': Search },
      { initialUrl: '/items/7?tag=a&tag=b&q=x%3Dy%26z' },
    );

    expect(screen.getByTestId('search')).toHaveTextContent(
      '?tag=a&tag=b&q=x%3Dy%26z',
    );
  });

  it('is empty without a query', async () => {
    await renderRouter({ index: Search });

    expect(screen.getByTestId('search')).toHaveTextContent('', {
      exact: true,
    });
  });
});
