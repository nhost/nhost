import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

export type InputProps = TextInputProps & { className?: string };

export function Input({ className, editable, ...props }: InputProps) {
  return (
    <TextInput
      editable={editable}
      placeholderTextColor="#a3a3a3"
      className={cn(
        'h-11 rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-900',
        editable === false && 'opacity-50',
        className,
      )}
      {...props}
    />
  );
}
