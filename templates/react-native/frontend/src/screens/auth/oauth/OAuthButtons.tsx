import { StyleSheet, View } from 'react-native';
import LastUsedBadge from '@/components/LastUsedBadge';
import { Button } from '@/components/ui/button';
import ProviderIcon from './ProviderIcon';

export type OAuthButton = {
  id: string;
  label: string;
  lastUsed?: boolean;
  onPress: VoidFunction;
};

/** One button per provider. */
export default function OAuthButtons({
  buttons,
  disabled,
}: {
  buttons: OAuthButton[];
  disabled?: boolean;
}) {
  return (
    <View style={styles.list}>
      {buttons.map((button) => (
        <Button
          key={button.id}
          title={button.label}
          variant="outline"
          disabled={disabled}
          onPress={button.onPress}
          style={styles.button}
        >
          <ProviderIcon id={button.id} />
          {button.lastUsed ? <LastUsedBadge /> : null}
        </Button>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  button: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});
