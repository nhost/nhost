import { type ReactNode, useState } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import Dialog from '@/components/Dialog';
import { Button } from '@/components/ui/button';
import { colors, fontSize } from '@/theme';

/**
 * The rows of the account screen's settings, a line between each. Every row
 * draws the line above it, and the list hides the first one.
 */
export function SettingsList({ children }: { children: ReactNode }) {
  return (
    <View style={styles.list}>
      <View style={styles.firstLineHidden}>{children}</View>
    </View>
  );
}

/** One row of a `SettingsList`. */
export function SettingsItem({ style, ...props }: ViewProps) {
  return <View style={[styles.item, style]} {...props} />;
}

function SettingRow({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SettingsItem style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      {children}
    </SettingsItem>
  );
}

/** A row whose button opens a dialog with `children` in it. */
export function DialogSetting({
  label,
  value,
  action,
  title,
  description,
  destructive = false,
  open: givenOpen,
  onOpenChange,
  onOpen,
  children,
}: {
  label: string;
  value: ReactNode;
  action: string;
  title: string;
  description?: ReactNode;
  destructive?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called as the row's button opens the dialog. */
  onOpen?: VoidFunction;
  children: ReactNode;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = givenOpen ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;

  return (
    <SettingRow label={label} value={value}>
      <Button
        title={action}
        variant="outline"
        size="sm"
        labelStyle={destructive ? styles.destructive : undefined}
        onPress={() => {
          onOpen?.();
          setOpen(true);
        }}
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
      >
        {children}
      </Dialog>
    </SettingRow>
  );
}

const styles = StyleSheet.create({
  list: {
    overflow: 'hidden',
  },
  firstLineHidden: {
    marginTop: -StyleSheet.hairlineWidth,
  },
  item: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  label: {
    width: 96,
    color: colors.foreground,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  value: {
    flex: 1,
    minWidth: 0,
    color: colors.mutedForeground,
    fontSize: fontSize.sm,
  },
  destructive: {
    color: colors.destructive,
  },
});
