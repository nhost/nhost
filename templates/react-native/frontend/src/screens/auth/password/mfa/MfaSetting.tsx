import type { User } from '@nhost/nhost-js/auth';
import * as Clipboard from 'expo-clipboard';
import { useId, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { DialogClose, DialogFooter } from '@/components/Dialog';
import { DialogSetting } from '@/components/Setting';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRefresh } from '@/components/useRefresh';
import { NETWORK_ERROR } from '@/lib/nhost/errors';
import {
  disableMfa,
  enableMfa,
  generateMfa,
  type MfaSetup,
} from '@/screens/auth/password/mfa/actions';
import { groupedKey, totpUri } from '@/screens/auth/password/mfa/totp';
import { colors, fontSize, monospace, radius } from '@/theme';

/** Two-factor, as a row on the account screen. */
export default function MfaSetting({ user }: { user: User }) {
  // What a change here made it, until the refreshed screen agrees: reopening
  // the dialog before then would otherwise offer the change just made.
  const reported = user.activeMfaType === 'totp';
  const [changed, setChanged] = useState<{ from: boolean; to: boolean }>();
  const active = changed?.from === reported ? changed.to : reported;
  const refresh = useRefresh();
  const toast = useToast();
  // The copied key's toast goes when the dialog does: it is about a key
  // that is no longer on screen.
  const dismissCopied = useRef<VoidFunction>(undefined);
  const codeId = useId();

  const [open, setOpen] = useState(false);
  // Which way the dialog was opened.
  const [turningOff, setTurningOff] = useState(active);
  const [setup, setSetup] = useState<MfaSetup | undefined>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const start = async (): Promise<void> => {
    setIsPending(true);
    try {
      const result = await generateMfa();
      if (result.error || !result.setup) {
        setError(result.error ?? 'Could not start the setup.');
        return;
      }

      setSetup(result.setup);
    } catch (err) {
      console.error('Error starting the two-factor setup:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  const handleOpen = (): void => {
    setCode('');
    setError(undefined);
    setTurningOff(active);
    // A fresh secret on every opening. The backend stores it on the account
    // right away, and one shown earlier and closed is not worth keeping.
    if (!active) {
      setSetup(undefined);
      void start();
    }
  };

  const ready = turningOff || setup !== undefined;
  const codeLabel = turningOff ? 'Code' : '2. Enter the 6-digit code.';
  const canSubmit = !isPending && ready && /^\d{6}$/.test(code.trim());

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    setError(undefined);
    setIsPending(true);
    try {
      const result = turningOff
        ? await disableMfa(code.trim())
        : await enableMfa(code.trim());
      if (result.error) {
        setError(result.error);
        return;
      }

      // The screen reads the account's state from the auth service, so the
      // row changes when it is rendered again rather than being guessed at
      // here.
      setChanged({ from: reported, to: !turningOff });
      setOpen(false);
      setCode('');
      toast(turningOff ? 'Two-factor is off' : 'Two-factor is on');
      refresh();
    } catch (err) {
      console.error('Error changing two-factor:', err);
      setError(NETWORK_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  // Typing a key this long from the screen is where entering it by hand goes
  // wrong, so it can be pasted instead.
  const copyKey = async (
    key: string,
    message = 'Key copied',
  ): Promise<void> => {
    try {
      await Clipboard.setStringAsync(key);
      dismissCopied.current = toast(message);
    } catch (err) {
      console.error('Error copying the two-factor key:', err);
      toast('Could not copy the key');
    }
  };

  // No `canOpenURL` first: it only answers for schemes the app declares
  // up front, and the open itself says whether an app took the link.
  const openAuthenticator = async (): Promise<void> => {
    if (!setup) {
      return;
    }
    try {
      await Linking.openURL(totpUri(setup.totpSecret, user));
    } catch {
      await copyKey(
        setup.totpSecret,
        'No authenticator app opened the link. Key copied',
      );
    }
  };

  const turning = turningOff ? 'off' : 'on';

  return (
    <DialogSetting
      label="Two-factor"
      value={
        <>
          <Text style={active ? styles.on : styles.off}>● </Text>
          {active ? 'On' : 'Off'}
        </>
      }
      action={active ? 'Turn off' : 'Set up'}
      title={turningOff ? 'Turn off two-factor' : 'Set up two-factor'}
      description={
        turningOff
          ? 'Enter a current code from your authenticator app to turn it off.'
          : 'Asks for a code from an authenticator app when you sign in with your password. Other sign-in methods and emailed links skip it.'
      }
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          dismissCopied.current?.();
        }
        setOpen(next);
      }}
      onOpen={handleOpen}
    >
      <View style={styles.form}>
        {/* Setting up is two steps, numbered so the dialog reads top to
            bottom: get the key into the app, then prove it with a code. */}
        {turningOff ? null : (
          <View style={styles.step}>
            <Text style={styles.stepTitle}>
              1. Add this account to your authenticator app.
            </Text>
            <View style={styles.setup}>
              <Button
                title="Open in authenticator"
                variant="outline"
                size="sm"
                disabled={!setup}
                onPress={() => void openAuthenticator()}
              />
              {/* For an authenticator on another device. */}
              {setup ? (
                <Image
                  source={{ uri: setup.imageUrl }}
                  accessibilityLabel="QR code for the authenticator app"
                  style={styles.qr}
                />
              ) : (
                <View style={[styles.qr, styles.placeholder]}>
                  <Text style={styles.hint}>
                    {isPending ? 'Preparing a code to scan…' : null}
                  </Text>
                </View>
              )}
              <Text style={styles.hint}>Or enter this key instead:</Text>
              <View style={styles.key}>
                {setup ? (
                  <>
                    <Text selectable style={styles.keyText}>
                      {groupedKey(setup.totpSecret)}
                    </Text>
                    <Pressable
                      role="button"
                      aria-label="Copy key"
                      hitSlop={8}
                      onPress={() => void copyKey(setup.totpSecret)}
                      style={({ pressed }) => [
                        styles.copy,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Svg
                        width={14}
                        height={14}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={colors.mutedForeground}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <Rect x={9} y={9} width={12} height={12} rx={2} />
                        <Path d="M5 15V5a2 2 0 0 1 2-2h10" />
                      </Svg>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        )}

        <View style={styles.field}>
          <Label nativeID={codeId}>{codeLabel}</Label>
          <Input
            aria-labelledby={codeId}
            label={codeLabel}
            inputMode="numeric"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            placeholder="000000"
            maxLength={6}
            returnKeyType="done"
            value={code}
            onChangeText={setCode}
            onSubmitEditing={() => void handleSubmit()}
            editable={!isPending && ready}
            style={styles.code}
          />
        </View>

        {error ? (
          <Text role="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <DialogFooter>
          <DialogClose disabled={isPending && ready} />
          <Button
            title={
              isPending && ready ? `Turning ${turning}…` : `Turn ${turning}`
            }
            size="sm"
            variant={turningOff ? 'destructive' : 'default'}
            disabled={!canSubmit}
            onPress={() => void handleSubmit()}
          />
        </DialogFooter>
      </View>
    </DialogSetting>
  );
}

const styles = StyleSheet.create({
  on: {
    color: colors.success,
  },
  off: {
    color: colors.mutedForeground,
  },
  form: {
    gap: 20,
  },
  step: {
    gap: 12,
  },
  stepTitle: {
    color: colors.foreground,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  setup: {
    alignItems: 'center',
    gap: 8,
  },
  qr: {
    width: 160,
    height: 160,
    borderRadius: radius.lg,
    borderWidth: 8,
    borderColor: '#ffffff',
    backgroundColor: '#ffffff',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderColor: colors.muted,
    backgroundColor: colors.muted,
  },
  hint: {
    color: colors.mutedForeground,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  key: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 40,
    maxWidth: 320,
  },
  keyText: {
    flexShrink: 1,
    color: colors.mutedForeground,
    fontFamily: monospace,
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  copy: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: radius.md,
  },
  pressed: {
    backgroundColor: colors.accent,
  },
  field: {
    gap: 8,
  },
  code: {
    fontFamily: monospace,
    letterSpacing: 4,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
  },
});
