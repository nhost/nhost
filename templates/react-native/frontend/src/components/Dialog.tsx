import { createContext, type ReactNode, use, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ToastStatus } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { colors, fontSize, radius } from '@/theme';

type Close = (then?: VoidFunction) => void;

const CloseDialog = createContext<Close>(() => undefined);

/**
 * Closes the dialog this renders inside, for a form that is done with it.
 * `then` runs once the dialog has gone.
 */
export function useCloseDialog(): Close {
  return use(CloseDialog);
}

/** A modal over the whole app; a press on the backdrop closes it. */
export default function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const afterClose = useRef<VoidFunction | undefined>(undefined);

  // Only iOS says when a modal has gone; Android's goes at once.
  const close: Close = (then) => {
    onOpenChange(false);
    if (Platform.OS === 'ios') {
      afterClose.current = then;
    } else {
      then?.();
    }
  };

  const dismissed = (): void => {
    const then = afterClose.current;
    afterClose.current = undefined;
    then?.();
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      // Android's back button and gesture.
      onRequestClose={() => close()}
      onDismiss={dismissed}
    >
      {/* Android too: drawn edge to edge, the modal's window does not shrink
          for the keyboard. */}
      <KeyboardAvoidingView style={styles.center} behavior="padding">
        <Pressable
          accessibilityLabel="Close"
          style={styles.backdrop}
          onPress={() => close()}
        />
        <View role="dialog" aria-modal aria-label={title} style={styles.dialog}>
          <View style={styles.header}>
            <Text role="heading" style={styles.title}>
              {title}
            </Text>
            {description ? (
              <Text style={styles.description}>{description}</Text>
            ) : null}
          </View>
          <CloseDialog value={close}>{children}</CloseDialog>
        </View>
        <ToastStatus />
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** The buttons at the foot of a dialog, with the one that acts last. */
export function DialogFooter({ children }: { children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

/** Closes the dialog without doing anything else. */
export function DialogClose({
  disabled,
  title = 'Cancel',
}: {
  disabled?: boolean;
  title?: string;
}) {
  const close = useCloseDialog();

  return (
    <Button
      title={title}
      variant="outline"
      size="sm"
      disabled={disabled}
      onPress={() => close()}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    gap: 20,
    padding: 24,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  header: {
    gap: 6,
  },
  title: {
    color: colors.foreground,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  description: {
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
