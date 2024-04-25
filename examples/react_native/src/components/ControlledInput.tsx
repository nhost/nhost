import {Controller, ControllerProps, type Control} from 'react-hook-form';
import {TextInput, TextInputProps} from 'react-native';

interface InputProps extends TextInputProps, Pick<ControllerProps, 'rules'> {
  control: Control<any, any>;
  name: string;
}

export default function ControlledInput({control, name, ...props}: InputProps) {
  return (
    <Controller
      control={control}
      render={({field: {onChange, onBlur, value}}) => (
        <TextInput
          value={value}
          onBlur={onBlur}
          onChangeText={value => onChange(value)}
          {...props}
        />
      )}
      name={name}
      rules={props.rules}
    />
  );
}
