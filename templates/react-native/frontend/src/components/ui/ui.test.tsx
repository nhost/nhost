import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { Platform, type TextInputInstance } from 'react-native';
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
        <Input aria-labelledby="email-label" label="Email" />
      </>,
    );

    await fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.c');

    expect(screen.getByLabelText('Email')).toHaveDisplayValue('a@b.c');
  });
});

describe('Input', () => {
  // A form's Next key moves to the following field through this ref.
  it('hands its ref to the text field', async () => {
    const ref = createRef<TextInputInstance>();

    await render(
      <Input ref={ref} aria-labelledby="email-label" label="Email" />,
    );

    expect(ref.current?.focus).toEqual(expect.any(Function));
  });

  // `getByLabelText` also resolves `aria-labelledby`, which iOS ignores, so
  // these check the prop each platform reads.
  it('names itself with its label on iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');

    await render(<Input aria-labelledby="email-label" label="Email" />);

    expect(screen.getByDisplayValue('')).toHaveProp(
      'accessibilityLabel',
      'Email',
    );
  });

  it('leaves the name to aria-labelledby on Android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');

    await render(<Input aria-labelledby="email-label" label="Email" />);

    const input = screen.getByDisplayValue('');
    expect(input).toHaveProp('aria-labelledby', 'email-label');
    expect(input).not.toHaveProp('accessibilityLabel', 'Email');
  });
});
