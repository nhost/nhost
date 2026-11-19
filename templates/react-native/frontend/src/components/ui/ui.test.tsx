import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

describe('Button', () => {
  it('is pressable by its title, unless disabled', async () => {
    const onPress = jest.fn();

    await render(<Button title="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(1);

    await render(<Button title="Save" onPress={onPress} disabled />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('Label', () => {
  it('names the field that points at it', async () => {
    await render(
      <>
        <Label nativeID="email-label">Email</Label>
        <Input aria-labelledby="email-label" />
      </>,
    );

    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.c');

    expect(screen.getByLabelText('Email')).toHaveDisplayValue('a@b.c');
  });
});
