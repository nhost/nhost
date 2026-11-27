import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, radius } from '@/theme';

type ShowToast = (message: string) => VoidFunction;
type Toast = { id: number; message: string };

const ToastContext = createContext<ShowToast>(() => () => undefined);
const CurrentToast = createContext<Toast | undefined>(undefined);

/** Shows `message` briefly at the foot of the screen. */
export function useToast(): ShowToast {
  return use(ToastContext);
}

/**
 * The current toast. The provider shows it over the screens, and a dialog
 * shows it again inside its modal, which covers everything else.
 */
export function ToastStatus() {
  const toast = use(CurrentToast);
  const { bottom } = useSafeAreaInsets();

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.region, { bottom: bottom + 24 }]}
    >
      {toast ? (
        <Text key={toast.id} style={styles.toast}>
          {toast.message}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A short line confirming that something worked, for the changes whose result
 * is not otherwise in view: a copied id, or a setting changed in a dialog that
 * has closed.
 */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const count = useRef(0);
  const [toast, setToast] = useState<Toast | undefined>();

  useEffect(() => {
    if (!toast) {
      return;
    }

    // Android reads a live region by itself; iOS has to be told.
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(toast.message);
    }

    const timer = setTimeout(() => setToast(undefined), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const show: ShowToast = (message) => {
    count.current += 1;
    const id = count.current;
    setToast({ id, message });

    return () =>
      setToast((current) => (current?.id === id ? undefined : current));
  };

  return (
    <ToastContext value={show}>
      <CurrentToast value={toast}>
        {children}
        <ToastStatus />
      </CurrentToast>
    </ToastContext>
  );
}

const styles = StyleSheet.create({
  region: {
    position: 'absolute',
    pointerEvents: 'none',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  toast: {
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    color: colors.foreground,
    fontSize: fontSize.sm,
  },
});
