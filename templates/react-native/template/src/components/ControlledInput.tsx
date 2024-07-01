import { Controller, ControllerProps, type Control } from 'react-hook-form'
import { StyleSheet, TextInput, TextInputProps } from 'react-native'

interface InputProps extends TextInputProps, Pick<ControllerProps, 'rules'> {
  control: Control<any, any>
  name: string
}

export default function ControlledInput({ control, name, ...props }: InputProps) {
  return (
    <Controller
      control={control}
      render={({ field: { onChange, onBlur, value } }) => (
        <TextInput
          value={value}
          onBlur={onBlur}
          onChangeText={(newValue) => onChange(newValue)}
          style={styles.input}
          {...props}
        />
      )}
      name={name}
      rules={props.rules}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    padding: 13,
    borderRadius: 10,
    alignSelf: 'stretch',
    backgroundColor: '#f1f1f1'
  }
})
