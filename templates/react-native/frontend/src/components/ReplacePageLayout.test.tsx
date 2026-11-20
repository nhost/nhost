import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import ReplacePageLayout, {
  useReplacePage,
} from '@/components/ReplacePageLayout';
import { Button } from '@/components/ui/button';

function Form() {
  const replacePage = useReplacePage();
  return (
    <Button title="Done" onPress={() => replacePage(<Text>All done</Text>)} />
  );
}

describe('ReplacePageLayout', () => {
  it('shows what a form under it puts in place of the screen', async () => {
    await render(
      <ReplacePageLayout>
        <Text>The form</Text>
        <Form />
      </ReplacePageLayout>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(screen.getByText('All done')).toBeOnTheScreen();
    expect(screen.queryByText('The form')).toBeNull();
  });
});
