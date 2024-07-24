import { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle
} from 'react-native'

interface ButtonProps extends PressableProps {
  loading?: boolean
  label: string | ReactNode
  color?: string
  styles?: StyleProp<ViewStyle>
}

export default function Button({
  styles,
  loading,
  label,
  color = 'royalblue',
  ...props
}: ButtonProps) {
  return (
    <Pressable style={({ pressed }) => [buttonStyles(pressed, color).button, styles]} {...props}>
      {loading && <ActivityIndicator color="white" style={buttonStyles().activityIndicator} />}
      {typeof label === 'string' ? <Text style={buttonStyles().buttonText}>{label}</Text> : label}
    </Pressable>
  )
}

const buttonStyles = (pressed: boolean = false, color: string = 'royalblue') =>
  StyleSheet.create({
    button: {
      flexGrow: 1,
      padding: 12,
      width: '100%',
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: color,
      opacity: pressed ? 0.9 : 1
    },
    buttonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold'
    },
    activityIndicator: {
      position: 'absolute',
      right: 10,
      top: '55%'
    }
  })
