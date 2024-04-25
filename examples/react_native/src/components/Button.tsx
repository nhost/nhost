import React from 'react';
import {ActivityIndicator, Pressable, PressableProps, Text} from 'react-native';

interface ButtonProps extends PressableProps {
  loading: boolean;
  label: string;
  color?: string;
}

export default function Button({
  style,
  loading,
  label,
  color = 'royalblue',
  ...props
}: ButtonProps) {
  return (
    <Pressable
      style={({pressed}) => [
        {
          alignItems: 'center',
          opacity: pressed ? 0.9 : 1,
        },
        {
          width: '100%',
          padding: 12,
          borderRadius: 10,
          backgroundColor: color,
        },
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={{color: 'white', fontWeight: 'bold'}}>{label}</Text>
      )}
    </Pressable>
  );
}
